'use strict';
var express = require('express');
var session = require('client-sessions');
var router = express.Router();
router.use(session({
    cookieName: 'session',
    secret: '4SORi5lNEIApzvLV4kmZ',
    duration: 30 * 60 * 1000,
    activeDuration: 5 * 60 * 1000,
}));

/* GET home page. */
router.get('/', function (req, res) {
    console.log(req.session);
    if (req.session && req.session.carryOverUsername) {
        res.render('index', {
            title: 'Express',
            carryOverUsername: req.session.carryOverUsername
        });
    } else {
        res.render('index', {
            title: 'Express'
        });
    }
   
});

module.exports = router;
