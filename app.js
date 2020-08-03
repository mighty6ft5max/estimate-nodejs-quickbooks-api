"use strict";

require("dotenv").config();

/**
 * Require the dependencies
 * @type {*|createApplication}
 */

var {
  CLIENT_ID,
  CLIENT_SECRET,
  ENVIRONMENT,
  NGROK_ENABLED,
  PORT,
  REDIRECT_URI,
} = process.env;

var express = require("express");
var app = express();
var path = require("path");
var OAuthClient = require("intuit-oauth");
var bodyParser = require("body-parser");
var ngrok = NGROK_ENABLED === "true" ? require("ngrok") : null;
/**
 * Configure View and Handlebars
 */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "/public")));
app.engine("html", require("ejs").renderFile);
app.set("view engine", "html");
app.use(bodyParser.json());

var urlencodedParser = bodyParser.urlencoded({ extended: false });

/**
 * App Variables
 * @type {null}
 */

var oauth2_token_json = null,
  auth_vars = {
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    environment: ENVIRONMENT,
    redirectUri: REDIRECT_URI,
  };

/**
 * Instantiate new Client
 * @type {OAuthClient}
 */

var oauthClient = null;

/**
 * Home Route
 */

app.get("/", function (req, res) {
  res.render("index", { name: "did we pass it?" });
});

/**
 * Get NGROK status
 */

app.get("/ngrokEnabled", function (req, res) {
  res.send(NGROK_ENABLED);
});

/**
 * Get the AuthorizeUri
 */

app.get("/authUri", urlencodedParser, function (req, res) {
  if (!oauthClient) {
    oauthClient = new OAuthClient({
      ...auth_vars,
      redirectUri: req.query.json.redirectUri,
    });
  }
  var authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: "intuit-test",
  });
  res.send(authUri);
});

/**
 * Handle the callback to extract the `Auth Code` and exchange them for `Bearer-Tokens`
 */

app.get("/callback", function (req, res) {
  oauthClient
    .createToken(req.url)
    .then(function (authResponse) {
      oauth2_token_json = JSON.stringify(authResponse.getJson(), null, 2);
    })
    .catch(function (e) {
      console.error(e);
    });

  res.send("");
});

/**
 * Refresh the access-token
 */

app.get("/refreshAccessToken", urlencodedParser, function (req, res) {
  if (!oauthClient) {
    oauthClient = new OAuthClient({
      ...auth_vars,
      redirectUri: req.query.json.redirectUri,
    });
  }
  oauthClient
    .refresh()
    .then(function (authResponse) {
      console.log(
        "The Refresh Token is  " + JSON.stringify(authResponse.getJson())
      );
      oauth2_token_json = JSON.stringify(authResponse.getJson(), null, 2);
      res.send(oauth2_token_json);
    })
    .catch(function (e) {
      console.error(e);
    });
});

app.post("/getEstimates", function (req, res) {
  var companyID = oauthClient.getToken().realmId,
    { queryType, start, end } = req.body;

  var url =
    oauthClient.environment == "sandbox"
      ? OAuthClient.environment.sandbox
      : OAuthClient.environment.production;

  var selectStatement =
      queryType === "single"
        ? `SELECT * from ESTIMATE WHERE DocNumber = '${start}'`
        : `SELECT * from ESTIMATE WHERE DocNumber >= '${start}' AND DocNumber <= '${end}'`,
    estimateQueryString =
      url +
      "v3/company/" +
      companyID +
      "/query?query=" +
      selectStatement +
      "&minorversion=52";

  oauthClient
    .makeApiCall({
      url: estimateQueryString,
    })
    .then(function (authResponse) {
      // console.log(
      //   "The response for API call is :" + JSON.stringify(authResponse)
      // );
      res.send(JSON.parse(authResponse.text()));
    })
    .catch(function (e) {
      console.error(e);
    });
});

const server = app.listen(PORT || 8000, () => {
  console.log(`Server listening on port ${server.address().port}`);
  if (!ngrok) {
    console.log(`See app at http://localhost:${server.address().port}`);
  }
});

if (ngrok) {
  console.log("NGROK is enabled");
  async function connectNGROK() {
    try {
      const url = await ngrok.connect({ addr: PORT || 8000 }); //{ addr: PORT || 8000 }
      console.log("See app at " + url);
    } catch {
      console.log("There was an error");
    }
  }
  connectNGROK();
}
