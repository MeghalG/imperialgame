var express = require("express");
var router = express.Router();
var clicks = 0;
router.post("/increment", function(req, res, next) {
	clicks = clicks+req.body.incrementClicks;
});
router.get("/getClicks", function(req, res, next) {
    res.send(clicks.toString());
});
module.exports = router;