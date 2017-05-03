'use strict';
var express = require('express');
var session = require('client-sessions');
var ical2json = require('ical2json'); //TODO add to project
var fs = require('fs'); //read file streams
var router = express.Router();
var multer = require('multer');
var bodyParser = require('body-parser');
var upload = multer({ dest: 'uploads/' })
var mysql = require('mysql');
//TODO: requires session (authentication with cookies)
router.use(session({
    cookieName: 'session',
    secret: '4SORi5lNEIApzvLV4kmZ',
    duration: 30 * 60 * 1000,
    activeDuration: 5 * 60 * 1000,
}));

var getConnection = function () {
    var connection = mysql.createConnection({
        host: 'localhost',
        user: 'augudyne',
        password: 'patch1997',
        database: 'msfthacks'
    });

    return connection;
};
/* GET home page. */
router.get('/', function (req, res) {
    if (req.session && req.session.user) {
        res.render('dashboard', {
            welcomeMsg: 'Welcome ' + req.session.user
        });
    } else {
        res.redirect("/");
    }

});

/* Handle File Upload */
router.post('/', upload.single('file'), function (req, res) {
    fs.readFile(req.file.path, function (err, data) {
        if (err) {
            return console.log(err);
        }
        console.log();
        //construct an object with every event
        var result = ical2json.convert(data.toString());
        var eventPairs = { "Events": [] };
        for (var event in result['VEVENT']) {
            eventPairs['Events'].push({
                "STARTTIME": result['VEVENT'][event]["DTSTART;TZID=America/Vancouver"],
                "ENDTIME": result['VEVENT'][event]["DTEND;TZID=America/Vancouver"]
            });
        }

        //make them into more workable courseEvent objects -> list them still
        var courseEvents2016 = [];
        var courseEvents2017 = [];
        var CourseEvent = function (startDate, endDate) {
            this.startDate = startDate;
            this.endDate = endDate;
            this.duration = Math.abs((startDate - endDate)) / (1000 * 60); // in minutes
        };
        for (var i in eventPairs['Events']) {
            //note that 48 x 30 minute inc in day
            //lets multiply hour by 2, and add minutes/30 <- integer floor;
            var eventStart = eventPairs['Events'][i]['STARTTIME'];
            var eventEnd = eventPairs['Events'][i]['ENDTIME'];
            //start time
            var year = eventStart.slice(0, 4);
            var month = parseInt(eventStart.slice(4, 6)) - 1;
            var day = eventStart.slice(6, 8);
            var hours = eventStart.slice(9, 11);
            var minutes = eventStart.slice(11, 13);
            console.log("Hours: ", hours);
            var startDate = new Date(year, month, day, hours, minutes);
            console.log("Start Date: ", startDate.toString());
            //end time
            year = eventEnd.slice(0, 4);
            month = parseInt(eventEnd.slice(4, 6)) - 1;
            day = eventEnd.slice(6, 8);
            hours = eventEnd.slice(9, 11);
            console.log("Hours: ", hours);
            minutes = eventEnd.slice(11, 13);
            var endDate = new Date(year, month, day, hours, minutes);
            console.log("End Date: ", endDate.toString());
            var tempCourseEvent = new CourseEvent(startDate, endDate);
            console.log(tempCourseEvent.startDate.getYear());
            if (tempCourseEvent.startDate.getYear() == '117') {
                courseEvents2017.push(tempCourseEvent);
            } else {
                courseEvents2016.push(tempCourseEvent);
            }
        }
        //helper
        var toMonth = function (day) {
            switch (day) {
                case 0:
                    return "Sunday";
                case 1:
                    return "Monday";
                case 2:
                    return "Tuesday";
                case 3:
                    return "Wednesday";
                case 4:
                    return "Thursday";
                case 5:
                    return "Friday";
                case 6:
                    return "Saturday";
            }
        }

        //consumes a courseEvent Array and returns an array with each day compressed into binary availability
        var compressToArray = function (courseEvents) {
            var weekSchedule = {
                "0": [],
                "1": [],
                "2": [],
                "3": [],
                "4": [],
                "5": [],
                "6": []
            };
            //now lets clean the courseEvents array by sorting events into day bins
            //note that weekSchedule[0] is Sunday, while [1] is Monday

            for (var i in courseEvents) {
                weekSchedule[courseEvents[i].startDate.getDay().toString()].push(courseEvents[i]);
            }
            var weekScheduleCompressed = [];
            //now lets construct daily strings
            for (var i = 0; i < 7; i++) {
                var compressInt = 0;
                for (var j in weekSchedule[i.toString()]) {
                    var eventString = "";
                    var beginIndex = (weekSchedule[i.toString()][j].startDate.getHours() * 2);
                    var duration = weekSchedule[i.toString()][j].duration / 30;//get duration in terms of 30 minute increments
                    for (var c = 0; c < 48; c++) {
                        if (c >= beginIndex && duration > 0) {
                            eventString += "1";
                            --duration;
                        } else {
                            eventString += "0";
                        }
                    }
                    compressInt = (compressInt | parseInt(eventString, 2));
                }
                var resultString = "";
                for (var b = 0; b < 48 - compressInt.toString(2).length; b++) {
                    resultString += "0";
                }
                resultString += compressInt.toString(2);
                weekScheduleCompressed.push(resultString);
            }
            return weekScheduleCompressed;
        };

        var userID = req.session.user;
        var result2016 = compressToArray(courseEvents2016);
        var result2017 = compressToArray(courseEvents2017);

        //add these to user's schedule database
        var connection = getConnection();
        var queryCheckUserExists = "SELECT id FROM availability_2016 WHERE id = ?";
        //query if user does not exist 
        var dne_query2016db = "INSERT INTO availability_2016(Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday, id) VALUES(?, ?, ?, ?, ?, ?, ?, ?)";
        var dne_query2017db = "INSERT INTO availability_2017(Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday, id) VALUES(?, ?, ?, ?, ?, ?, ?, ?)";
        //query if user exists
        var e_query2016db = "UPDATE availability_2016 SET Monday = ?, Tuesday = ? , Wednesday = ?, Thursday = ?, Friday = ?, Saturday = ?, Sunday = ? WHERE id = ?";
        var e_query2017db = "UPDATE availability_2017 SET Monday = ?, Tuesday = ? , Wednesday = ?, Thursday = ?, Friday = ?, Saturday = ?, Sunday = ? WHERE id = ?";

        var addUserToDatabase = function () {
            //TODO:add user to database using SQL
            console.log(result2016);
            var params2016 = [result2016[1], result2016[2], result2016[3], result2016[4], result2016[5],
            result2016[6], result2016[0], userID];
            var params2017 = [result2017[1], result2017[2], result2017[3], result2017[4], result2017[5],
            result2017[6], result2017[0], userID];

            connection.query(dne_query2016db, params2016, function (err, res, fields) { if (!!err) { console.log(err); } });
            connection.query(dne_query2017db, params2017, function (err, res, fields) { if (!!err) { console.log(err); } });
        };




        var updateUserInDatabase = function () {
            //TODO: update user in database with SQL
            var params2016 = [result2016[1], result2016[2], result2016[3], result2016[4], result2016[5],
            result2016[6], result2016[0], userID];
            var params2017 = [result2017[1], result2017[2], result2017[3], result2017[4], result2017[5],
                result2017[6], result2017[0], userID];
            connection.query(e_query2016db, params2016, function (err, res, fields) { if (!!err) { console.log(err); } });
            connection.query(e_query2017db, params2017, function (err, res, fields) { if (!!err) { console.log(err); } });
        };

        //query the databse
        connection.query(queryCheckUserExists, userID, function (err, results, fields) {
            if (!!err) {
                console.log("An SQL error occured ", err.toString());
            } else if (results.length == 0) {
                console.log("Availibility for user was not found...adding to database");
                addUserToDatabase();
            } else if (results.length == 1) {
                console.log("User was found...updating database");

                updateUserInDatabase();
            } else {
                console.log("An uncaught exception occurred in connection query...");
            }
        });

        var result = JSON.stringify({
            "2016": result2016,
            "2017": result2017
        }, null, 4);

        res.render('dashboard', {
            welcomeMsg: 'Welcome ' + req.session.user,
            fileAsJSON: result
        });
    });
});




module.exports = router;