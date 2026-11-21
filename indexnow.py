#!/usr/bin/env python3
"""Ping IndexNow (Bing, Yandex, etc.) with every URL in site/sitemap.xml. Run after deploy."""
import json, re, urllib.request
from build import DOMAIN, INDEXNOW_KEY
urls = re.findall(r"<loc>(.*?)</loc>", open("site/sitemap.xml").read())
body = json.dumps({"host": DOMAIN.split("//")[1], "key": INDEXNOW_KEY,
                   "keyLocation": f"{DOMAIN}/{INDEXNOW_KEY}.txt", "urlList": urls}).encode()
req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body,
                             headers={"Content-Type": "application/json; charset=utf-8"})
print(urllib.request.urlopen(req).status, len(urls), "urls")
