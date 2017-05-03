'use strict';
var express = require('express');
var crypto = require('crypto');
var mysql = require('mysql');
var session = require('client-sessions')
var router = express.Router();

router.use(session({
    cookieName: 'session',
    secret: '4SORi5lNEIApzvLV4kmZ',
    duration: 30 * 60 * 1000,
    activeDuration: 5 * 60 * 1000,
}));




router.get('/', function (req, res) {
    res.render('register');
});

router.post('/', function (req, res) {
    

    var makePasswordData = function (password) {
        var randomSalt = crypto.randomBytes(8).toString('hex').slice(0, 16);
        var hash = crypto.createHmac('sha512', randomSalt);
        hash.update(password);
        return {
            "salt": randomSalt,
            "hash": hash.digest('hex')
        }
    };
    var insertUser = function (userdata) {
        /* data given as
        username
        salt
        hash
        */
        var bindData = [userdata.username, userdata.salt, userdata.hash];


        var connection = getConnection();
        var str = "INSERT INTO users(username, salt, hash) VALUES(? , ? , ?)";
        connection.query(str, bindData , function (err, result, fields) {
            if (!!err) {
                console.log("SQL Error Inserting");
                return false;
            } else {
                console.log("Success");
            }
        });

        connection.end();
        return true;
    };

    //register button clicked
    if (req.body.username && req.body.password && (req.body.password === req.body.confirmPassword)) {
        //the user is attempting to register with username and password
        var username = req.body.username;
        var password = req.body.password;
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
        connection.query("SELECT * FROM users WHERE username = ?", username, function (err, data, fields) {
            if (!!err) {
                console.log("SQL Error ", err);
            } else if (data.length > 0) {
                console.log("User Already Exists");
                res.render('register', { errorMsg: "Username Already Exists" });
            } else {
                //user does not currently exists, lets create him!     
                console.log("Making password data");
                var passwordData = makePasswordData(password);
                var userData = {
                    "username": username,
                    "salt": passwordData.salt,
                    "hash": passwordData.hash
                };

                var wasSuccess = insertUser(userData);
                if (wasSuccess) {
                    req.session.carryOverUsername = username;
                    res.redirect('/');
                } else {
                    res.render('register', { errorMsg: 'An error occurred trying to create user. Please try again.' });
                }
            }

        });

        connection.end();
    } else if (req.body.username && req.body.password) {
        res.render('register', { errorMsg: "Passwords are not identical!" });

    } else {
        res.render('register', { errorMsg: "Invalid POST request..." });
    }
});

var getConnection = function () {
    return mysql.createConnection({
        host: 'localhost',
        user: 'augudyne',
        password: 'patch1997',
        database: 'msfthacks'
    });
};



module.exports = router;