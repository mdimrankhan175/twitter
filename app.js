const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "twitterClone.db");
const app = express();

app.use(express.json());

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(-1);
  }
};
initializeDBAndServer();

//register API
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUser = `SELECT * FROM user WHERE username='${username}'`;
  const dbUser = await db.get(selectUser);
  if (dbUser === undefined) {
    lengthOfPassword = password.length;
    if (lengthOfPassword < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createNewUser = `INSERT INTO user(username,password,name,gender)
            VALUES(
                '${username}',
                '${hashedPassword}',
                '${name}','${gender}'
            )`;
      const newUser = await db.run(createNewUser);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});
//login API

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUser = `SELECT * FROM user WHERE username='${username}'`;
  const dbUser = await db.get(selectUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    isCorrect = await bcrypt.compare(password, dbUser.password);
    if (isCorrect === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "sai");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
const authenticateToken = (request, response, next) => {
  const authHead = request.headers["authorization"];
  let jwtToken;
  if (authHead !== undefined) {
    jwtToken = authHead.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "sai", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;

        next();
      }
    });
  }
};
// app.get("/", authenticateToken, async (request, response) => {
//  const { username } = request;
//  const gettingUserId = `select user_id from user where username='${username}'`;
//  const getAUser = await db.get(gettingUserId);
//  const getFollowing = `SELECT following_user_id from follower WHERE follower_user_id=${getAUser.user_id}`;
//  const tableFollowing = await db.all(getFollowing);
//  console.log(tableFollowing);
// });

//all tweet

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;

  // Get the user ID of the authenticated user
  const getUserIdQuery = `
    SELECT user_id
    FROM user
    WHERE username = '${username}'
  `;
  const user = await db.get(getUserIdQuery);
  const userId = user.user_id;

  // Get the latest 4 tweets of the people the user follows
  const getFollowingTweetsQuery = `
    SELECT tweet.tweet, user.username AS username, tweet.date_time AS dateTime
    FROM tweet
    JOIN follower ON follower.following_user_id = tweet.user_id
    JOIN user ON user.user_id = tweet.user_id
    WHERE follower.follower_user_id = ${userId}
    ORDER BY tweet.date_time DESC
    LIMIT 4
  `;
  const tweets = await db.all(getFollowingTweetsQuery);

  response.send(tweets);
});

//following table

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;

  // Get the user ID of the authenticated user
  const getUserIdQuery = `
    SELECT user_id
    FROM user
    WHERE username = '${username}'
  `;
  const user = await db.get(getUserIdQuery);
  const userId = user.user_id;

  // Get the names of people whom the user follows
  const getFollowingNamesQuery = `
    SELECT user.name
    FROM user
    JOIN follower ON follower.following_user_id = user.user_id
    WHERE follower.follower_user_id = ${userId}
  `;
  const followingNames = await db.all(getFollowingNamesQuery);

  response.send(followingNames);
});

//follower table
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;

  // Get the user ID of the authenticated user
  const getUserIdQuery = `
    SELECT user_id
    FROM user
    WHERE username = '${username}'
  `;
  const user = await db.get(getUserIdQuery);
  const userId = user.user_id;

  // Get the list of names of people who follow the user
  const getFollowersQuery = `
    SELECT user.name
    FROM user
    JOIN follower ON follower.follower_user_id = user.user_id
    WHERE follower.following_user_id = ${userId}
  `;
  const followers = await db.all(getFollowersQuery);

  response.send(followers);
});

// GET request to '/tweets/:tweetId/' to return the tweet
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;

  // Get the user ID of the authenticated user
  const getUserIdQuery = `
    SELECT user_id
    FROM user
    WHERE username = '${username}'
  `;
  const user = await db.get(getUserIdQuery);
  const userId = user.user_id;

  // Check if the user follows the author of the tweet
  const checkFollowingQuery = `
    SELECT tweet.user_id
    FROM tweet
    JOIN follower ON follower.following_user_id = tweet.user_id
    WHERE follower.follower_user_id = ${userId}
      AND tweet.tweet_id = ${tweetId}
  `;
  const tweetAuthor = await db.get(checkFollowingQuery);

  if (tweetAuthor) {
    // User follows the tweet author, so fetch the tweet
    const getTweetQuery = `
      SELECT tweet
      FROM tweet
      WHERE tweet_id = ${tweetId}
    `;
    const tweet = await db.get(getTweetQuery);

    response.send(tweet);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//tweet likes

// GET request to '/tweets/:tweetId/likes/' to return the list of usernames who liked the tweet
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;

    try {
      const findTweetUser = `
      SELECT user_id
      FROM tweet
      WHERE tweet_id = ${tweetId}`;
      const tweetUser = await db.get(findTweetUser);

      if (tweetUser === undefined) {
        response.status(404).send("Tweet not found");
      } else {
        const findFollower = `
        SELECT COUNT(*) AS count
        FROM follower
        WHERE follower_user_id = ${tweetUser.user_id}
        AND following_user_id = (
          SELECT user_id
          FROM user
          WHERE username = '${username}'
        )`;
        const followerCheck = await db.get(findFollower);

        if (followerCheck === undefined || followerCheck.count === 0) {
          response.status(401).send("Invalid Request");
        } else {
          const getLikes = `
          SELECT user.username
          FROM user
          INNER JOIN like ON user.user_id = like.user_id
          WHERE like.tweet_id = ${tweetId}`;
          const likes = await db.all(getLikes);
          response.json({ likes });
        }
      }
    } catch (error) {
      response.status(500).send("Internal server error");
    }
  }
);

// GET request to '/tweets/:tweetId/replies/' to return the tweet and the list of all replies

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;

    try {
      const findTweetUser = `
      SELECT user_id
      FROM tweet
      WHERE tweet_id = ${tweetId}`;
      const tweetUser = await db.get(findTweetUser);

      if (tweetUser === undefined) {
        response.status(404).send("Tweet not found");
      } else {
        const findFollower = `
        SELECT COUNT(*) AS count
        FROM follower
        WHERE follower_user_id = ${tweetUser.user_id}
        AND following_user_id = (
          SELECT user_id
          FROM user
          WHERE username = '${username}'
        )`;
        const followerCheck = await db.get(findFollower);

        if (followerCheck === undefined || followerCheck.count === 0) {
          response.status(401).send("Invalid Request");
        } else {
          const getReplies = `
          SELECT user.name, reply.reply AS replies
          FROM user
          INNER JOIN reply ON user.user_id = reply.user_id
          WHERE reply.tweet_id = ${tweetId}`;
          const replies = await db.all(getReplies);

          const getTweet = `
          SELECT tweet.tweet
          FROM tweet
          WHERE tweet_id = ${tweetId}`;
          const tweet = await db.get(getTweet);

          response.json({ tweet, replies });
        }
      }
    } catch (error) {
      response.status(500).send("Internal server error");
    }
  }
);

//tweets of user

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;

  const getUserTweets = `SELECT tweet.tweet, COUNT(DISTINCT \`like\`.user_id) as likes,
    COUNT(DISTINCT reply.user_id) as replies, tweet.date_time as dateTime
    FROM tweet
    LEFT JOIN \`like\` ON tweet.tweet_id = \`like\`.tweet_id
    LEFT JOIN reply ON tweet.tweet_id = reply.tweet_id
    WHERE tweet.user_id = (SELECT user_id FROM user WHERE username = '${username}')
    GROUP BY tweet.tweet_id`;

  const tweets = await db.all(getUserTweets);

  response.send(tweets);
});

//posting a tweet

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;

  const timeNow = new Date();

  const postTweet = `INSERT INTO tweet(tweet, date_time)
    VALUES ('${tweet}', '${timeNow}')`;

  const addATweet = await db.run(postTweet);

  response.send("Created a Tweet");
});
app.post("/user/tweets/", (request, response) => {
  response.status(401);
  response.send("Invalid JWT Token");
});

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const findingUserId = `SELECT user_id FROM user where username='${username}'`;
    const getUserId = await db.get(findingUserId);
    const findingTweetUserId = `SELECT user_id FROM tweet WHERE tweet_id=${tweetId}`;
    const gettingTweetId = await db.get(findingTweetUserId);
    if (getUserId.user_id !== gettingTweetId.user_id) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const deleteTweet = `DELETE FROM tweet
        WHERE tweet_id=${tweetId}`;
      const res = await db.run(deleteTweet);
      response.send("Tweet Removed");
    }
  }
);
module.exports = app;
