'use strict';
var express = require('express');
var mysql = require('mysql');
var crypto = require('crypto');
var session = require('client-sessions');
var router = express.Router();

//TODO: requires session (authentication with cookies)
router.use(session({
    cookieName: 'session',
    secret: '4SORi5lNEIApzvLV4kmZ',
    duration: 30 * 60 * 1000,
    activeDuration: 5 * 60 * 1000,
}));



/* Handle Login (POST) Requests */
router.post('/', function (req, res) {
    var username = req.body.username.toLowerCase();
    var password = req.body.password;

    var getInputHash = function (password, salt) {
        console.log("Generating hash with user Salt");
        var hash = crypto.createHmac('sha512', salt);
        hash.update(password);
        var value = hash.digest('hex');
        return value;
    }

    //handle login request where:
    //req.username and req.password is given
    var connection = mysql.createConnection({
        host: 'localhost',
        user: 'augudyne',
        password: 'patch1997',
        database: 'msfthacks'
    });
    connection.connect(function (error) {
        //callback
        if (!!error) {
            console.log('Error');
        } else {
            console.log('Connected');
        }
    });

    //get the user's login information
    connection.query("SELECT * FROM users WHERE username = ?", username, function (err, data, fields) {
        //when sql completed
        if (!!err) {
            //error has occured
            console.log("An error occured trying to execute SQL Statement: " + err.toString());
            res.render('index', {title: "Error", errorMsg:"SQL Error"});
        }else if (data.length == 0) {
            console.log("Username: " , username , " was not found in the database");
            res.render('index', { errorMsg: "Username: " + username + " was not found" });
        } else {
            //assume user was found, now we authenticate the password by decrypting
            var userID = data[0].id;
            var userHash = data[0].hash;
            var userSalt = data[0].salt;
            var inputHash = getInputHash(password, userSalt);

            if (userHash == inputHash) {
                //successful authentication
                req.session.user = userID;
                console.log("Redirecting...");
                res.redirect("/dashboard");
            } else {    
                console.log("Incorrect Password");
                res.render('index', {
                    title: 'Express',
                    errorMsg: 'Incorrect Password',
                    carryOverUsername: username});
            }
        }
    });
    connection.end();

});


module.exports = router;
