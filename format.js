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
    ['-l', '--link', 'show link to original post'],
    ['--timestampids', 'use timestamp ids'],
    ['--videoposters', 'use video posters (see makevideoposters.sh)'],
    ['--styleprefix PREFIX', 'style name prefix (defaults to mastodon)'],
    ['--startedbyaccount', 'only format threads started by this account'],
    ['--startedwithmedia', 'only format threads started with media']
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

var timestampids = false;
parser.on('timestampids', function(opt) {
    timestampids = true;
});

var videoposters = false;
parser.on('videoposters', function(opt) {
    videoposters = true;
});

var styleprefix = "mastodon";
parser.on('styleprefix', function(opt, value) {
    styleprefix = value;
});

var startedbyaccount = false;
parser.on('startedbyaccount', function(opt) {
    startedbyaccount = true;
});

var startedwithmedia = false;
parser.on('startedwithmedia', function(opt) {
    startedwithmedia = true;
});

var args = parser.parse(process.argv);

var ids = args.slice(2);


if (verbose) {
    console.log("loading data from "+dir);
    console.log("using style prefix "+styleprefix);
}

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
    var p_id = timestampids?p.date.toISOString().replace(/[a-zA-Z\-\:\.]+/g, ""):p.object.id;
    var text = p.object.content;
    var media = [];
    var alts = [];
    if (p.object.attachment != undefined) {
        for (var i = 0; i < p.object.attachment.length; i++) {
            media.push(dir+p.object.attachment[i].url)
            alts.push(p.object.attachment[i].name)
        }
    }
    var str = "<div class='"+styleprefix+"_post'>\n"+
        "<div class='"+styleprefix+"_post_avatar'><img src='"+avatar+"'></div>\n"+
        "<div class='"+styleprefix+"_post_header'>\n"+
        " <span class='"+styleprefix+"_post_displayname'>"+actor.name+"</span> <span class='"+styleprefix+"_post_username'>@"+actor.preferredUsername+"</span> • <span class='"+styleprefix+"_post_timestamp'>"+p.date.toDateString()+"</span> <span class='"+styleprefix+"_post_id'>"+p_id+"</span>\n"+
        "</div>\n";
    if (link && p.object.inReplyTo != null && posts_byid[p.object.inReplyTo] == undefined) {
        str += "<div class='"+styleprefix+"_post_reply'>\n"+
            "↩️ <span class='"+styleprefix+"_post_replyid'><a href='"+p.object.inReplyTo+"'>"+p.object.inReplyTo+"</a></span>\n"+
            "</div>";
    }
    str += "<div class='"+styleprefix+"_post_body'>\n"+
        "<p>"+text+"</p>\n"+
        "</div>\n";
    if (media.length > 0) {
        str += "<div class='"+styleprefix+"_post_media'>\n";
        for (var i = 0; i < media.length; i++) {
            if (alts[i]) {
                str += "<div title='"+alts[i].replace(/'/g,"&#39;").replace(/\n/g, "&#13;")+"'>\n";
            }
            if (media[i].endsWith("mp4")) {
                if (videoposters) {
                    str += "<video class='"+styleprefix+"_post_video' poster='"+media[i]+"-poster.jpg' preload='none' controls><source src='"+media[i]+"' type='video/mp4'>Your browser does not support the video tag.</video>\n";
                } else {
                    str += "<video class='"+styleprefix+"_post_video' controls><source src='"+media[i]+"' type='video/mp4'>Your browser does not support the video tag.</video>\n";
                }
            } else {
                str += "<img class='"+styleprefix+"_post_img' src='"+media[i]+"'>\n";
            }
            if (alts[i]) {
                str += "</div>\n";
            }
        }
        str += "</div>\n";
    }
    if (link) {
        str += "<div class='"+styleprefix+"_post_original'>\n"+
            "• <a href='"+p.object.id+"'>"+p.object.id+"</a> •\n"+
            "</div>\n";
    }
    str += "</div>\n";
    return str;
}

function formatThread(p) {
    var str = "<div class='"+styleprefix+"_thread'>\n";
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
            "."+styleprefix+"_thread { width: 600px }\n"+
            "."+styleprefix+"_post { margin: 1%; border: solid 1px; width: 94%; padding: 2%; font-family: sans-serif; font-size: small }\n"+
            "."+styleprefix+"_post_avatar { display: inline-block; position: relative; width: 48px; height: 48px; overflow: hidden; border-radius: 50%; float: left; margin-right: 10px; margin-bottom: 10px }\n"+
            "."+styleprefix+"_post_avatar img { width: 100%; height: 100% }\n"+
            "."+styleprefix+"_post_header { margin-left: 60px }\n"+
            "."+styleprefix+"_post_displayname { font-weight: bold }\n"+
            "."+styleprefix+"_post_username { color: gray }\n"+
            "."+styleprefix+"_post_timestamp { color: gray }\n"+
            "."+styleprefix+"_post_id { float: right; display: none }\n"+
            "."+styleprefix+"_post_reply { margin-top: 2% }\n"+
            "."+styleprefix+"_post_replyid { }\n"+
            "."+styleprefix+"_post_body { margin-top: 2%; margin-left: 60px }\n"+
            "."+styleprefix+"_post_media { margin-top: 2% }\n"+
            "."+styleprefix+"_post_img { width: 100% }\n"+
            "."+styleprefix+"_post_video { width: 100% }\n"+
            "."+styleprefix+"_post_original { margin-top: 2%; text-align: center; font-size: x-small }\n"+
            "  </style>\n"+
            " </head>\n"+
            " <body>\n"+
            "  <ul>");
for (var i = 0; i < threads.length; i++) {
    var p = threads[i];
    var p_id = timestampids?p.date.toISOString().replace(/[a-zA-Z\-\:\.]+/g, ""):p.object.id.split("/").slice(-1)[0];
    if (ids.length > 0 && ids.indexOf(p_id) < 0) continue;
    if (startedbyaccount && p.object.inReplyTo) continue;
    if (startedwithmedia && (p.object.attachment == undefined || p.object.attachment.length == 0)) continue;
    console.log("<li> THREAD "+p_id);
    console.log(formatThread(p));
}
console.log("  </ul>\n"+
            " </body>\n"+
            "</html>")
