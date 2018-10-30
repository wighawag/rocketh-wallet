"use strict";

var middleware = [
    function (req, res, next) {
        console.log(req.url);
        if(req.url == '/iframe.html') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            // res.setHeader('Cache-Control', 'public, max-age=31536000'); // TODO
            // res.setHeader('ETag', 'fixed1'); // TODO
        }
        next();
    }
];

/// Export configuration options
module.exports = {
    port: 3000,
    server : {
        baseDir : "./wallet" ,
        middleware : middleware
    },
    open: false
}
