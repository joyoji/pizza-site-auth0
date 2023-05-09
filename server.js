const express = require("express");
const morgan = require("morgan");
const helmet = require("helmet");
const { auth } = require("express-oauth2-jwt-bearer");
const { join } = require("path");
const authConfig = require("./auth_config.json");
// https://auth0.github.io/node-auth0/
const ManagementClient = require('auth0').ManagementClient
const managementClient = new ManagementClient({
  domain: authConfig.domain,
  clientId: authConfig.clientId,
  clientSecret: authConfig.clientSecret,
  audience: authConfig.audience,
  scope: 'read:users update:users'
})

// for order data
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.text());

if (!authConfig.domain || !authConfig.audience) {
  throw "Please make sure that auth_config.json is in place and populated";
}

app.use(morgan("dev"));
app.use(helmet());
app.use(express.static(join(__dirname, "public")));

const checkJwt = auth({
  audience: authConfig.audience,
  issuerBaseURL: `https://${authConfig.domain}`,
});

app.get("/api/external", checkJwt, (req, res) => {
  res.send({
    msg: "Your access token was successfully validated!"
  });
});


app.post("/api/order", checkJwt, (req, res) => {
  res.send({
    msg: "Your pizza order was successfully placed!" + req.body
  });

  // update user metadata
  const userId = req.headers.userid; 

  // output userId to console log
  console.log("userId: " + userId);        

  // Get the user's existing metadata
  managementClient.getUser({ id: userId }, (err, user) => {
    if (err) {
      console.error(err);
      return;
    }  

    console.log(" managementClient.getUser done"); 

    // Use the user ID to update the user metadata as shown in my previous answer
    const metadata = user.user_metadata || {};

    // Get the existing order data array or create an empty array if none exists
    const orders = metadata.orders || [];

    // Add the new order data to the array
    orders.push(req.body);

    // output orders to console log
    console.log("orders: " + orders);

    // Update the metadata with the new order data
      managementClient.updateUserMetadata({ userId }, { orders }, (err, updatedUser) => {
      if (err) {
        console.error(err);
        return;
      }
    });
  });    
});

app.get("/auth_config.json", (req, res) => {
  res.sendFile(join(__dirname, "auth_config.json"));
});

app.get("/*", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

app.use(function(err, req, res, next) {
  if (err.name === "UnauthorizedError") {
    return res.status(401).send({ msg: "Invalid token" });
  }

  next(err, req, res);
});

process.on("SIGINT", function() {
  process.exit();
});

module.exports = app;
