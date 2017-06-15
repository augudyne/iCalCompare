function attemptLogin() {
    //attempt login with jQuery
    var username = $('#username').val().trim();
    var password = $('#password').val().trim();
    console.log(username);
    //check that fields are not empty
    if (username != "" && password != "") {
        //fields are not empty, try to login
        console.log("Username: " , username);
        var data = {
            "username": username,
            "password": password
        };
        //let server direct me!
    } else {
        alert("Cannot Leave Fields Empty!!!");
    }

};