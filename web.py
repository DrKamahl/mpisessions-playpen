#!/usr/bin/env python3

import functools
import os
import sys

from os import path
from bottle import get, request, response, route, run, static_file

import playpen

@get("/")
def serve_index():
    response = static_file("web.html", root="static")

    # XSS protection is a misfeature unleashed upon the world by Internet
    # Explorer 8. It uses ill conceived heuristics to block or mangle HTTP
    # requests in an attempt to prevent cross-site scripting exploits. It's yet
    # another idea from the "enumerating badness" school of security theater.
    #
    # Rust and JavaScript are both languages using a C style syntax, and GET
    # queries containing Rust snippets end up being classified as cross-site
    # scripting attacks. Luckily, there's a header for turning off this bug.
    response.set_header("X-XSS-Protection", "0")

    return response

@get("/<path:path>")
def serve_static(path):
    return static_file(path, root="static")

@functools.lru_cache(maxsize=256)
def execute(command, arguments, code):
    print("running:", command, arguments, file=sys.stderr, flush=True)
    return playpen.execute(command, arguments, code)

def enable_post_cors(wrappee):
    def wrapper(*args, **kwargs):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Origin, Accept, Content-Type"

        if request.method != "OPTIONS":
            return wrappee(*args, **kwargs)

    return wrapper

try:
    SEPI_JAR = path.abspath(sys.argv[1])
except IndexError:
    print("Usage: web.py SEPI_JAR", file=sys.stderr)
    sys.exit(255)

PREFIX = path.join(path.abspath(sys.path[0]), 'bin')

# Programs generate an output that is separated by a 0xFF. Anything
# before the separator is ignored. Anything after the separator is considered
# to be the output.
def simple_exec(command, args):
    out, _ = execute(command, args, request.json["code"])
    return {"result": out.replace(b"\xff", b"", 1).decode(errors="replace")}

RUN = path.join(PREFIX, "run.sh")
@route("/run.json", method=["POST", "OPTIONS"])
@enable_post_cors
def scribble():
    return simple_exec(RUN, (SEPI_JAR,))

os.chdir(sys.path[0])
run(host='0.0.0.0', port=8080, server='cherrypy')
