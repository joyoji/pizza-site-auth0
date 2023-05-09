// The Auth0 client, initialized in configureClient()
let auth0Client = null;
let managementClient = null;

/**
 * Starts the authentication flow
 */
const login = async (targetUrl) => {
  try {
    console.log("Logging in", targetUrl);

    const options = {
      authorizationParams: {
        redirect_uri: window.location.origin
      }
    };

    if (targetUrl) {
      options.appState = { targetUrl };
    }

    await auth0Client.loginWithRedirect(options);
  } catch (err) {
    console.log("Log in failed", err);
  }
};

/**
 * Executes the logout flow
 */
const logout = async () => {
  try {
    console.log("Logging out");
    await auth0Client.logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  } catch (err) {
    console.log("Log out failed", err);
  }
};

/**
 * Retrieves the auth configuration from the server
 */
const fetchAuthConfig = () => fetch("/auth_config.json");

/**
 * Initializes the Auth0 client
 */
const configureClient = async () => {
  const response = await fetchAuthConfig();
  const config = await response.json();

  auth0Client = await auth0.createAuth0Client({
    domain: config.domain,
    clientId: config.clientId,
    authorizationParams: {
      audience: config.audience
    }
  });
};

/**
 * Checks to see if the user is authenticated. If so, `fn` is executed. Otherwise, the user
 * is prompted to log in
 * @param {*} fn The function to execute if the user is logged in
 */
const requireAuth = async (fn, targetUrl) => {
  const isAuthenticated = await auth0Client.isAuthenticated();

  if (isAuthenticated) {
    return fn();
  }

  return login(targetUrl);
};

/**
 * Calls the API endpoint with an authorization token
 */
const callApi = async () => {
  try {
    const token = await auth0Client.getTokenSilently();

    const response = await fetch("/api/external", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const responseData = await response.json();
    const responseElement = document.getElementById("api-call-result");

    responseElement.innerText = JSON.stringify(responseData, {}, 2);

    document.querySelectorAll("pre code").forEach(hljs.highlightBlock);

    eachElement(".result-block", (c) => c.classList.add("show"));
  } catch (e) {
    console.error(e);
  }
};

/**
 * Calls the API to order Pizza
 */
const callOrderPizza = async () => {
  try {

    console.log("executing callOrderPizza");
    // check email verification first
    const token = await auth0Client.getTokenSilently();

    const userInfo = await auth0Client.getUser();
    const responseElement = document.getElementById("order-pizza-result");
    const pizzainfo = document.getElementById("pizzainfo");
    const responseData = null;

    console.log("check email verification");

    // output userInfo.email_verified value
    console.log("userInfo.email_verified: " + userInfo.email_verified);

    if (!userInfo.email_verified) {
      // show error message  
      const errorMessage = 'Please verify your email address before calling this API.';
      responseElement.innerText = errorMessage;
    }else{
      // generate uuid
      const orderid = Math.random().toString(36).substring(2, 15);

      // generate timestamp string
      const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

      // attach uuid and timestamp to pizzainfo
      const requestdata = "orderid: " + orderid + ", date: " + timestamp + ", " + pizzainfo.value ;

      // output pizzainfo
      console.log("userInfo.sub: " + userInfo.sub);

      // call api to order pizza by POST method
      const response = await fetch("/api/order", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          Authorization: `Bearer ${token}`,
          userid: userInfo.sub
        },
        body: requestdata
      });
  
      const responseData = await response.json();      
      responseElement.innerText = JSON.stringify(responseData, {}, 2);


    }

    document.querySelectorAll("pre code").forEach(hljs.highlightBlock);

    eachElement(".orderresult-block", (c) => c.classList.add("show"));

  } catch (e) {
    console.error(e);
  }
};

// Will run when page finishes loading
window.onload = async () => {
  await configureClient();

  // If unable to parse the history hash, default to the root URL
  if (!showContentFromUrl(window.location.pathname)) {
    showContentFromUrl("/");
    window.history.replaceState({ url: "/" }, {}, "/");
  }

  const bodyElement = document.getElementsByTagName("body")[0];

  // Listen out for clicks on any hyperlink that navigates to a #/ URL
  bodyElement.addEventListener("click", (e) => {
    if (isRouteLink(e.target)) {
      const url = e.target.getAttribute("href");

      if (showContentFromUrl(url)) {
        e.preventDefault();
        window.history.pushState({ url }, {}, url);
      }
    } else if (e.target.getAttribute("id") === "call-api") {
      e.preventDefault();
      callApi();
    } else if (e.target.getAttribute("id") === "order-pizza") {
      e.preventDefault();
      callOrderPizza();
    }
  });

  const isAuthenticated = await auth0Client.isAuthenticated();

  if (isAuthenticated) {
    console.log("> User is authenticated");
    window.history.replaceState({}, document.title, window.location.pathname);
    updateUI();
    return;
  }

  console.log("> User not authenticated");

  const query = window.location.search;
  const shouldParseResult = query.includes("code=") && query.includes("state=");

  if (shouldParseResult) {
    console.log("> Parsing redirect");
    try {
      const result = await auth0Client.handleRedirectCallback();

      if (result.appState && result.appState.targetUrl) {
        showContentFromUrl(result.appState.targetUrl);
      }

      console.log("Logged in!");
    } catch (err) {
      console.log("Error parsing redirect:", err);
    }

    window.history.replaceState({}, document.title, "/");
  }

  updateUI();
};
