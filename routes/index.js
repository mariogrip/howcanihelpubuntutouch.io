const express = require('express');
const fs = require('fs');
const router = express.Router();

const AREAS = "./areas/"

var areas = {}
var first;
var last;

const getPage = (pages, items) => {
  if (!items)
    items = areas;
  var page = pages.shift();
  if (!items[page])
    return false;
  if (pages.length <= 0)
    return items[page]
  return getPage(pages, items[page].items);
}

const sortItems = (items, parent) => {
  var ret = {};
  var first;
  var last;
  items.forEach((item) => {
    var fname = item.name.toLowerCase();
    item.link = parent+"/"+fname;
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

router.get('/:page(*)', function(req, res, next) {
  if (req.params.page === "")
    req.params.page = first
  var pages = req.params.page.split("/");
  var page = getPage(pages);
  if (!page)
    res.status(404).send("not found");
  else
    res.render('index', page);
});


module.exports = router;
