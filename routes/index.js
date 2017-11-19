const express = require('express');
const fs = require('fs');
const requestExt = require('request-extensible');
const RequestHttpCache = require('request-http-cache');

const router = express.Router();

const AREAS = "./areas/"

const httpRequestCache = new RequestHttpCache({
  ttl: 86400
});

const request = requestExt({
  extensions: [
    httpRequestCache.extension
  ]
});

const time = () => Math.floor(new Date() / 1000)

var areas = {}
var first;
var last;

var ghIssueCache = {expire:0};
// Internal
const getGhIssues = (cb) => {
  console.log("gh request");
  var now=time();

  // Cache baby cache!!! :D :D
  if (ghIssueCache.expire > now) {
    console.log("use cache")
    return cb(false, ghIssueCache.data);
  }

  console.log("get new");
  request({
    method: "get",
    url: "https://api.github.com/repos/ubports/ubuntu-touch/issues",
    qs: {
      labels: "good first issue"
    },
    json: true,
    headers: {
      'User-Agent': 'howcanihelpubuntutouch.io'
    }
  }, (err, res, body) => {
    // If we hit an error, try using cache!
    if (err)
      cb(false, ghIssueCache.data)
    cb(err, body);
    // 3 munutes cache! github api has ratelimit, this keeps us well under that
    ghIssueCache.expire = time()+180;
    ghIssueCache.data = body;
  });
}

const bugsList = (parent, cb) => {
  console.log("buglist request");
  getGhIssues((err, body) => {
    if (err)
      return cb(true);
    var issues = [];
    body.forEach((issue) => {
      issues.push({
        name: issue.title,
        id: issue.number,
        url: issue.html_url,
        title: "I would like to fix"
      });
    });
    cb(false, sortItems(issues, parent), issues[0].id);
  })
}

const getPage = (pages, items, cb) => {
  if (!items)
    items = areas;
  var page = pages.shift();
  if (!items[page])
    return cb(false);
  if (pages.length <= 0)
    return cb(items[page]);
  if (items[page].internal){
    console.log("internal", items[page].internal)
    if (items[page].internal === "bugs") {
      console.log("got bug")
      bugsList(items[page].link.replace("/list", ""), (err, item, first) => {
        console.log(items[page].name)
        if (pages.includes("list"))
          return cb(false, items[page].link.replace("list", first))
        return getPage(pages, item, cb)
      });
      return;
    }
  }
  return getPage(pages, items[page].items, cb);
}

const sortItems = (items, parent) => {
  var ret = {};
  var first;
  var last;
  items.forEach((item) => {
    var fname = item.name.toLowerCase();
    if (item.id)
      fname = item.id;
    item.link = parent+"/"+fname;
    if (item.internal)
      item.link = item.link+"/"+"list";
    item.parent = parent
    if (!first)
      first = fname;
    if (last)
      ret[last].next = parent+"/"+fname;
    last = fname;

    if (item.items) {
      var link = item.link
      item.link = item.link+"/"+item.items[0].name.toLowerCase();
      item.items = sortItems(item.items, link)
    }

    ret[fname] = item;
  })

  // loop it around :)
  ret[last].next = parent+"/"+first;

  return ret;
}

fs.readdirSync(AREAS).forEach(file => {
  if (file.endsWith(".json")) {
    var fname = file.replace(".json", "");
    var obj = JSON.parse(fs.readFileSync(AREAS+file, 'utf8'));
    obj.link = fname;
    if (!first)
      first = fname;
    if (last)
      areas[last].next = fname;
    last = fname;

    if (obj.items) {
      var link = obj.link
      obj.link = obj.link+"/"+obj.items[0].name.toLowerCase();
      obj.items = sortItems(obj.items, link)
    }

    areas[fname] = obj;
  }
});

// loop it around :)
areas[last].next = first;

router.get("/api/issues", function(req, res, next) {
  getGhIssues((err, body) => {
    if (err) {
      res.status(500).send("server error");
      return;
    }
    res.send(body);
  })
})

router.get('/:page(*)', function(req, res, next) {
  if (req.params.page === "")
    req.params.page = first
  var pages = req.params.page.split("/");
  getPage(pages, false, (page, redirect) => {
    if (redirect) {
      console.log("redirect to", redirect);
      return res.redirect("/"+redirect);
    }
    if (!page)
      res.status(404).send("not found");
    else
      res.render('index', page);
  });
});

module.exports = router;
