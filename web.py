#!/usr/bin/env python3

import functools
import os
import sys

from os import path
from bottle import get, request, response, route, run

import playpen

# CROSS-ORIGIN RESOURCE SHARING
# Allows this server to be used remotely by frontend servers (via HTML/JS)

def cors(method=["GET", "POST", "OPTIONS"]):
    def enable_cors(wrappee):
        def wrapper(*args, **kwargs):
            response.headers["Access-Control-Allow-Origin"] = "*"
            response.headers["Access-Control-Allow-Methods"] = ", ".join(method)
            response.headers["Access-Control-Allow-Headers"] = "Origin, Accept, Content-Type"

            if request.method != "OPTIONS":
                return wrappee(*args, **kwargs)

        return wrapper
    return enable_cors

enable_post_cors = cors(method=("POST", "OPTIONS"))
enable_get_cors = cors(method=("GET", "OPTIONS"))


@functools.lru_cache(maxsize=256)
def execute(command, arguments, code):
    print("running:", command, arguments, file=sys.stderr, flush=True)
    return playpen.execute(command, arguments, code)

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
run(host='0.0.0.0', port=55001, server='cherrypy')
