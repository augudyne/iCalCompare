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

//======================================================================
//GENERAL UTILITY
//======================================================================
function getConnection() {
    let myConn = mysql.createConnection({
        host: 'localhost',
        user: 'augudyne',
        password: 'patch1997',
        database: 'msfthacks'
    });
    return myConn;
};

/**
 * Wrapper function for performing a parameterized SQL Query, returns a promise that returns the SQL result on resolve
 * @param {any} queryString
 * @param {any} data
 * @returns a Promise for an sql query result
 */
function performQuery(queryString, data) {
    return new Promise(function (resolve, reject) {
        let myConn = getConnection();
        queryString = myConn.format(queryString, data);
        myConn.query(queryString, function (err, results, fields) {
            if (!!err) {
                console.log(err);
                reject(new Error("Unable to perform sql query: " + queryString));
            }

            resolve(results);
        });
    });
}

//======================================================================
//HTTP REQUEST ROUTING
//======================================================================
/* Route home page. */
router.get('/', function (req, res) {
    if (req.session && req.session.user) {
        //render the dashboard
        // - UserID
        // - ListOfFriends as array


        //get listOfFriends
        let listOfFriendsPromise = getListOfFriends(req.session.user);
        listOfFriendsPromise.then(function (listOfFriends) {
            console.log("Rendering list of friends: " + listOfFriends);
            res.render('dashboard', {
                welcomeMsg: 'Welcome ' + req.session.user,
                listOfFriends: listOfFriends
            });
        });

    } else {
        res.redirect("/");
    }

});

/* Handle Add Friend Search Query*/
router.post('/addFriend', function (req, res) {
    var username = req.body.searchName;
    let results = getResultsFromUsernameQuery(username).then(function (results) {
        console.log(results);
        if (results.length == 0 || results[0]['id'] == req.session.user) {
            //no user found...inform the display by setting notFound to true;
            console.log("No other user with name: " + username + " was found");
            res.render('dashboard', {
                welcomeMsg: 'Welcome ' + req.session.user,
                searchMsg: "No other user found with username " + username
            });
        } else {
            res.render('dashboard', {
                welcomeMsg: "Welcome " + req.session.user,
                foundUser: results[0]['username'].toString(),
                founderUserID: results[0]['id']
            });
        }
    })
})

/* Handle sending friend request */
router.post('/sendFriendRequest', function (req, res) {
    var friendToAddName = req.body.foundUsername;
    const friendToAddID = req.body.foundUserID;
    const userID = req.session.user;
    console.log(friendToAddName, friendToAddID, userID);
    let bool_hasReciprocalRequest = hasReciprocalRequest(userID, friendToAddID);
    if (bool_hasReciprocalRequest) {
        //confirm the friendship
        addFriendshipToTable(formatPairing(userID, friendToAddID));
        //delete the reciprocal request
        removeRequest(friendToAddID, userID);

        //render the screen
        renderReciprocalRequestExists(res, userID);
    } else {
        renderFriendRequestSent(res, userID);
    }
});

//======================================================================
// FRIEND SYSTEM FUNCITONALITY
//======================================================================

/**
 * Gets the list of friends associated with [userID] by looking at src and dst 
 * @param {any} userID
 * @returns listOfFriends :listof String
 */
function getListOfFriends(userID) {

    return new Promise(function (resolved, reject) {
        //get the list of friends
        var GET_FRIENDS_LIST = "SELECT(destID) FROM friends_list WHERE sourceID=?";
        var VALUE = userID;
        performQuery(GET_FRIENDS_LIST, VALUE).then(function (results) {
            var listOfFriends = [];
            if (results.length == 0) console.log("No rows returned");
            console.log(results.length + " friends were found");
            for (var i = 0; i < results.length; i++) {
                let resultRow = results[i];
                console.log(resultRow.destID);
                listOfFriends.push(parseInt(resultRow.destID));
            }
            resolved(listOfFriends);
        });
    }).then(function (listOfFriends) {
        //add the search for key being in the dest column
        return new Promise(function (resolved, reject) {
            let GET_FRIENDS_LIST = "SELECT(sourceID) from friends_list WHERE destID = ?";
            let VALUES = [userID];
            performQuery(GET_FRIENDS_LIST, VALUES).then(function (results) {
                for (var resultRow in results) {
                    console.log(resultRow.toString());
                    listOfFriends.push(parseInt(resultRow.toString()));
                }
                resolved(listOfFriends);
            });
        });
    }).then(function (listOfFriends) {
        console.log("listOfFriends in third promise: " + listOfFriends);
            var promisesArray = [];
            for (var i = 0; i < listOfFriends.length; i++) {
                promisesArray.push(getUsernameFromID(listOfFriends[i]));
            }
            return promisesArray;
        }).then(function (stringUsernames) {
            return Promise.all(stringUsernames);
        });
}

/**
 * Get the username of a user given its userID (from users table) as a promise
 * @param {any} userID
 * @returns the promise for the username : String associated with userID
 */
function getUsernameFromID(userID) {
    console.log("Getting username from ID: " + userID);
    let USERNAME_QUERY = "SELECT `username` FROM `users` WHERE id = ?";
    let VALUES = [userID];
    return performQuery(USERNAME_QUERY, VALUES).then(function (result) {
        console.log("Got Username: " , result[0].username);
        return result[0].username;
    }).catch(console.err);
}

/**
 * Returns a promise for the results of querying for <username> in users table
 * @param {string} username
 *@returns {promise} a promise for the query resolts <result row[]>
 */
function getResultsFromUsernameQuery (username) {
    let myConn = getConnection();
    var QUERY_FOR_PERSON = "SELECT id, username FROM users WHERE username=?";

    return new Promise(function (resolve, reject) {
        myConn.query(QUERY_FOR_PERSON, username, function (err, results) {
            if (!!err) {
                reject(err);
            }
            resolve(results);
        });
    })
}

/**
 * Removes a friend request pairing from the table friend_request_list
 * @param {any} sourceID
 * @param {any} destID
 */
function removeRequest(sourceID, destID) {
    let REMOVE_REQUEST_QUERY = "DELETE FROM friend_request_list WHERE sourceID = ? AND destID = ?";
    let VALUES = [sourceID, destID];
    performQuery(REMOVE_REQUEST_QUERY, VALUES).then(console.log("Removed request of " + sourceID + " to " + destID + " comepleted"));
}

/**
 * Returns an object with 2 fields: min{firstID, secondID}, max{firstID, secondID}
 * @param {int} firstID
 * @param {int} secondID
 * @returns an object with 2 fields, min and max
 */
function formatPairing(firstID, secondID) {
    if (firstID > secondID) {
        return { sourceID: secondID, destID: firstID };
    } else
        return { sourceID: firstID, destID: secondID };
}

/**
 *  Determine if friend_list database contains a friendship pair
 * @param {int} srcID the id of the person making the request
 * @param {int} dstID the id of the person receving the request
 * @param {boolean} true if the friendship pairing was found, false otherwise
 */
function containsFriendship(srcID, dstID) {
    //use from:min  to:max to perform a single query
    //locally defined promise generator
    function getFriendshipPairing(formattedPairing) {
        return new Promise(function (resolve, reject) {
            let myConn = getConnection();
            let SELECT_PAIR_FROM_LIST = "SELECT * FROM `friends_list` WHERE sourceID = ? AND destID = ?";
            SELECT_PAIR_FROM_LIST = myConn.format(SELECT_PAIR_FROM_LIST, [formattedPairing["min"], formattedPairing["max"]]);

            myConn.query(SELECT_PAIR_FROM_LIST, function (err, results, fields) {
                console.log(fields);
                if (!!err) {
                    console.log(err);
                    reject(new Error("SQL ERROR in getFriendshipPairing()"));
                }

                resolve(results);
            });
        })
    }

    //function control flow
    let formattedPairing = formatPairing(firstID, secondID);
    let results = getFriendshipPairing(formatPairing);
    results.then(function (results) {
        if (results.length == 0) {
            return false;
        } else return true;
    }).catch(console.error);
}

/**
 * Adds a friendship pairing to the SQL table of friends_list, formatted one-way, with src as min and dest as max
 * @param {Object} formatted pairing {sourceID: <param1>, destID: <param2>};
 * @returns {void}
 */
function addFriendshipToTable(friendPairing) {
    console.log("Confirming friendship between ", friendPairing.sourceID, " and ", friendPairing.destID);
    //check if contains, if it does, then don't do anything, otherwise we will '
    let ADD_FRIENDSHIP_QUERY = "INSERT INTO friends_list (`sourceID`, `destID`) SELECT * FROM (SELECT ?, ?) AS tmp\
                                WHERE NOT EXISTS (SELECT 1 FROM friends_list WHERE sourceID = ? AND destID = ?) LIMIT 1";
    let VALUES = [friendPairing.sourceID, friendPairing.destID, friendPairing.sourceID, friendPairing.destID];
    performQuery(ADD_FRIENDSHIP_QUERY, VALUES).then(console.log("Successfuly added friendship")).catch(console.err);
};

/**
 * Checks if a reciprocal friend request exists, in which case we will add the friendship and remove the request
 * Otherwise we will add the request to the table
 * @param {any} userID
 * @param {any} friendToAddID
 * @returns true if reciprocal request exists, false otherwise
 */
function hasReciprocalRequest(userID, friendToAddID) {
    let TAG = "checkIfReciprocalRequestOrAdd: ";
    console.log(TAG + "Looking for " + friendToAddID + " request to add " + userID);
    function getReciprocalQueryPromise(srcID, dstID) {
        //returns the results of the sql query for reciprocal request
        return new Promise(function (resolve, reject) {
            let myConn = getConnection();
            var CONTAINS_RECIPROCAL = "SELECT * FROM `friend_request_list` WHERE destID = ? AND sourceID = ?";
            CONTAINS_RECIPROCAL = myConn.format(CONTAINS_RECIPROCAL, [userID, friendToAddID]);
            myConn.query(CONTAINS_RECIPROCAL, function (err, rows, fields) {
                if (!!err) {
                    console.log(err);
                    reject(new Error("Error in " + TAG));
                }
                resolve(rows);
            });
        });
    }
    let results = getReciprocalQueryPromise(userID, friendToAddID);

    return results.then(function (rows) {      
        if (rows.length == 0) {
            return false;
        } else return true;
    });         
}



//======================================================================
//SCHEDULE FUNCTIONALITY
//======================================================================
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


//======================================================================
//PAGE RENDERING WRAPPER FUNCTIONS
//======================================================================


function renderSQLErrorOnAdd(res, userID) {
    res.render('dashboard', {
        welcomeMsg: "Welcome " + userID,
        searchMsg: "An SQL error occured trying to send friend request"
    });
}
function renderFriendRequestSent(res, userID) {
    res.render('dashboard', {
        welcomeMsg: "Welcome " + userID,
        searchMsg: "Friend Request Sent"
    });
}
function renderReciprocalRequestExists(res, userID) {
    res.render('dashboard', {
        welcomeMsg: "Welcome " + userID,
        searchMsg: "You both want to be friends! Confirming friendship now..."
    });
}

module.exports = router;