/*
 * MIT License
 *
 * Copyright (c) 2022 Greg Whitehead
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const optparse = require('optparse');

var switches = [
    ['-v', '--verbose', 'verbose output'],
    ['-d', '--dir PATH', 'mastodon archive directory'],
    ['-l', '--link', 'show link to original post']
];

var parser = new optparse.OptionParser(switches);

parser.banner = 'Usage: node format.js [options]';

var verbose = false;
parser.on('verbose', function(opt) {
    verbose = true;
});

var dir = ".";
parser.on('dir', function(opt, value) {
    dir = value;
});

var link = false;
parser.on('link', function(opt) {
    link = true;
});

var args = parser.parse(process.argv);

var ids = args.slice(2);


if (verbose) console.log("loading data from "+dir);

// actor
var actor = require(dir+"/actor.json");
if (verbose) console.log(actor);

var avatar = dir+"/"+actor.icon.url;
if (verbose) console.log(avatar);

// outbox
var outbox = require(dir+"/outbox.json");
if (verbose) console.log("loaded "+outbox.length+" outbox items");

var posts = []
for (var i = 0; i < outbox.orderedItems.length; i++) {
    var oi = outbox.orderedItems[i];
    if (oi.type == 'Create' && oi.object.type == 'Note') {
        posts.push(outbox.orderedItems[i]);
    }
}
if (verbose) console.log("found "+posts.length+" posts")

// parse dates, build posts_byid lookup table
var posts_byid = {}
for (var i = 0; i < posts.length; i++) {
    var p = posts[i];
    if (verbose) console.log(p);
    p.date = new Date(p.object.published);
    posts_byid[p.object.id] = p;
}

// build threads (chains of self-replies)
var threads = [];
for (var i = 0; i < posts.length; i++) {
    var p = posts[i];
    if (p.type == 'Create') {
        if (p.object.inReplyTo == null || posts_byid[p.object.inReplyTo] == undefined) {
            if (verbose) console.log(p.object.id);
            threads.push(p);
        } else if (posts_byid[p.object.inReplyTo] != undefined) {
            if (verbose) console.log(p.object.id+" -> "+p.object.inReplyTo);
            posts_byid[p.object.inReplyTo].thread = p;
        }
    }
}
if (verbose) console.log("found "+threads.length+" threads")

function formatPost(p) {
    var text = p.object.content;
    var imgs = [];
    if (p.object.attachment != undefined) {
        for (var i = 0; i < p.object.attachment.length; i++) {
            imgs.push(dir+p.object.attachment[i].url)
        }
    }
    var str = "<div class='post'>\n"+
        "<div class='post_avatar'><img src='"+avatar+"'></div>\n"+
        "<div class='post_header'>\n"+
        " <span class='post_displayname'>"+actor.name+"</span> <span class='post_username'>@"+actor.preferredUsername+"</span> • <span class='post_timestamp'>"+p.date.toDateString()+"</span> <span class='post_id'>"+p.object.id+"</span>\n"+
        "</div>\n";
    if (p.object.inReplyTo != null && posts_byid[p.object.inReplyTo] == undefined) {
        str += "<div class='post_reply'>\n"+
            "↩️ <span class='post_replyid'><a href='"+p.object.inReplyTo+"'>"+p.object.inReplyTo+"</a></span>\n"+
            "</div>";
    }
    str += "<div class='post_body'>\n"+
        "<p>"+text+"</p>\n"+
        "</div>\n";
    if (imgs.length > 0) {
        str += "<div class='post_imgs'>\n";
        for (var i = 0; i < imgs.length; i++) {
            str += "<img class='post_img' src=\""+imgs[i]+"\">\n";
        }
        str += "</div>\n";
    }
    if (link) {
        str += "<div class='post_original'>\n"+
            "• <a href='"+p.object.id+"'>"+p.object.id+"</a> •\n"+
            "</div>\n";
    }
    str += "</div>";
    return str;
}

function formatThread(p) {
    var str = "<div class='thread'>\n";
    str += formatPost(p);
    while (p.thread) {
        p = p.thread;
        str += formatPost(p);
    }
    str += "</div>";
    return str;
}


console.log("<!doctype html>\n"+
            "<html>\n"+
            " <head>\n"+
            "  <meta charset='utf-8'>\n"+
            "  <style>\n"+
            ".thread { width: 600px }"+
            ".post { margin: 1%; border: solid 1px; width: 94%; padding: 2%; font-family: sans-serif; font-size: small }\n"+
            ".post_avatar { display: inline-block; position: relative; width: 48px; height: 48px; overflow: hidden; border-radius: 50%; float: left; margin-right: 10px; margin-bottom: 10px }\n"+
            ".post_avatar img { width: 100%; height: 100% }\n"+
            ".post_header { margin-left: 60px }\n"+
            ".post_displayname { font-weight: bold }\n"+
            ".post_username { color: gray }\n"+
            ".post_timestamp { color: gray }\n"+
            ".post_id { float:right; display: none }\n"+
            ".post_reply { margin-top: 2% }\n"+
            ".post_replyid { }\n"+
            ".post_body { margin-top: 2%; margin-left: 60px }\n"+
            ".post_imgs { margin-top: 2% }\n"+
            //".post_imgs { margin-top: 2%; margin-left: 60px }\n"+
            ".post_img { width: 100% }\n"+
            ".post_original { margin-top: 2%; text-align: center; font-size: x-small }\n"+
            "  </style>\n"+
            " </head>\n"+
            " <body>\n"+
            "  <ul>");
for (var i = 0; i < threads.length; i++) {
    var p = threads[i];
    var p_id = p.object.id.split("/").slice(-1)[0];
    if (ids.length == 0 || ids.indexOf(p_id) >= 0) {
        console.log("<li> THREAD "+p_id);
        console.log(formatThread(p));
    }
}
console.log("  </ul>\n"+
            " </body>\n"+
            "</html>")
