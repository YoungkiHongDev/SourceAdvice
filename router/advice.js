const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.send("로그인");
});

router.get('/logout', (req, res) => {
    res.send("로그아웃");
});

module.exports = router;