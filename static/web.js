"use strict";

var samples = 2;

function send(path, data, callback) {
    var result = document.getElementById("result");

    result.textContent = "Running...";

    var request = new XMLHttpRequest();
    request.open("POST", path, true);
    request.setRequestHeader("Content-Type", "application/json");
    request.onreadystatechange = function() {
        if (request.readyState == 4) {
            var json;

            try {
                json = JSON.parse(request.response);
            } catch (e) {
                console.log("JSON.parse(): " + e);
            }

            if (request.status == 200) {
                callback(json);
            } else {
                result.textContent = "connection failure";
            }
        }
    }
    request.timeout = 10000;
    request.ontimeout = function() {
        result.textContent = "connection timed out"
    }
    request.send(JSON.stringify(data));
}

function evaluate(result, code, version, optimize) {
    send("/evaluate.json", {code: code, version: version, optimize: optimize},
         function(object) {
          result.textContent = object["result"];

          var div = document.createElement("div");
          div.className = "message";
          div.textContent = "Program ended.";
          result.appendChild(div);
    });
}

function compile(emit, result, code, version, optimize) {
    send("/compile.json", {emit: emit, code: code, version: version, optimize: optimize,
                           highlight: true},
         function(object) {
          if ("error" in object) {
              result.textContent = object["error"];
          } else {
              result.innerHTML = object["result"];
          }
    });
}

function format(result, session, version) {
    send("/format.json", {code: session.getValue(), version: version}, function(object) {
          if ("error" in object) {
              result.textContent = object["error"];
          } else {
              result.textContent = "";
              session.setValue(object["result"]);
          }
    });
}

function share(result, version, code) {
    var playurl = "http://play.rust-lang.org?code=" + encodeURIComponent(code);
    if (version != "master") {
        playurl += "&version=" + encodeURIComponent(version);
    }
    if (playurl.length > 5000) {
        result.textContent = "resulting URL above character limit for sharing. " +
            "Length: " + playurl.length + "; Maximum: 5000";
        return;
    }

    var url = "http://is.gd/create.php?format=json&url=" + encodeURIComponent(playurl);

    var request = new XMLHttpRequest();
    request.open("GET", url, true);

    request.onreadystatechange = function() {
        if (request.readyState == 4) {
            if (request.status == 200) {
                setResponse(JSON.parse(request.responseText)['shorturl']);
            } else {
                result.textContent = "connection failure";
            }
        }
    }

    request.send();

    function setResponse(shorturl) {
        while(result.firstChild) {
            result.removeChild(result.firstChild);
        }

        var link = document.createElement("a");
        link.href = link.textContent = shorturl;

        result.textContent = "short url: ";
        result.appendChild(link);
    }
}

function setSample(sample, session, result, index) {
    var request = new XMLHttpRequest();
    sample.options[index].selected = true;
    request.open("GET", "/sample/" + index + ".rs", true);
    request.onreadystatechange = function() {
        if (request.readyState == 4) {
            if (request.status == 200) {
                session.setValue(request.responseText.slice(0, -1));
            } else {
                result.textContent = "connection failure";
            }
        }
    }
    request.send();
}

function getQueryParameters() {
    var a = window.location.search.substr(1).split('&');
    if (a == "") return {};
    var b = {};
    for (var i = 0; i < a.length; i++) {
        var p = a[i].split('=');
        if (p.length != 2) continue;
        b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
    }
    return b;
}

function set_keyboard(editor, mode) {
    if (mode == "Emacs") {
        editor.setKeyboardHandler("ace/keyboard/emacs");
    } else if (mode == "Vim") {
        editor.setKeyboardHandler("ace/keyboard/vim");
    } else {
        editor.setKeyboardHandler(null);
    }
}

/*
 * Sets up the interface, by connecting the function handlers above to the
 * controls of the interface.
 */
addEventListener("DOMContentLoaded", function() {
    var evaluateButton = document.getElementById("evaluate");
    var asmButton = document.getElementById("asm");
    var irButton = document.getElementById("ir");
    var formatButton = document.getElementById("format");
    var shareButton = document.getElementById("share");
    var result = document.getElementById("result");
    var optimize = document.getElementById("optimize");
    var version = document.getElementById("version");
    var sample = document.getElementById("sample");
    var keyboard = document.getElementById("keyboard");
    /* Obtain the editor component */
    var editor = ace.edit("editor");
    var session = editor.getSession();
    /* Configure the editor's look and feel and the syntax it will highlight */
    editor.setTheme("ace/theme/github");
    session.setMode("ace/mode/rust");
    /* Optional: configure the keyboard's key bindings */
    var mode = localStorage.getItem("keyboard");
    if (mode !== null) {
        set_keyboard(editor, mode);
        keyboard.value = mode;
    }
    /* Get any parameters sent by submiting the form (aka the editor's
     * contents) */
    var query = getQueryParameters();
    if ("code" in query) {
        session.setValue(query["code"]);
    } else {
        var code = localStorage.getItem("code");
        if (code !== null) {
            session.setValue(code);
        } else {
            var index = Math.floor(Math.random() * samples);
            setSample(sample, session, result, index);
        }
    }
    /* the tools can have versions, probe the version supplied by the user
     * and set it in the UI */
    if ("version" in query) {
        version.value = query["version"];
    }
    /* 
     * XXX: No idea what this is.
     */ 
    if (query["run"] === "1") {
        evaluate(result, session.getValue(), version.options[version.selectedIndex].text,
                 optimize.options[optimize.selectedIndex].value);
    }
    /*
     * Store the code in the editor in the cache of the browser.
     */
    session.on("change", function() {
        localStorage.setItem("code", session.getValue());
    });
    /*
     * Connect the dropdown with the examples to the handler 'setSample'
     */
    sample.onchange = function() {
        setSample(sample, session, result, sample.selectedIndex);
    };
    /*
     * Connect the dropdown with the keyboard layouts to the handler 'set_keyboard'.
     * Plus, store the selected keyboard layout in the cache of the browser
     * whenever it is changed.
     */
    keyboard.onchange = function() {
        var mode = keyboard.options[keyboard.selectedIndex].value;
        localStorage.setItem("keyboard", mode);
        set_keyboard(editor, mode);
    }
    /*
     * Connect the button 'evaluate' to the handler 'evaluate'
     */
    evaluateButton.onclick = function() {
        evaluate(result, session.getValue(), version.options[version.selectedIndex].text,
                 optimize.options[optimize.selectedIndex].value);
    };
    /*
     * Connect the button 'asm' to the handler 'compile'
     */
    asmButton.onclick = function() {
        compile("asm", result, session.getValue(), version.options[version.selectedIndex].text,
                 optimize.options[optimize.selectedIndex].value);
    };
    /*
     * Connect the button 'ir' to the handler 'compile'
     */
    irButton.onclick = function() {
        compile("ir", result, session.getValue(), version.options[version.selectedIndex].text,
                 optimize.options[optimize.selectedIndex].value);
    };
    /*
     * Connect the button 'format' to the handler 'format'
     */
    formatButton.onclick = function() {
        format(result, session, version.options[version.selectedIndex].text);
    };
    /*
     * Connect the button 'format' to the handler 'format'
     */
    shareButton.onclick = function() {
        share(result, version.value, session.getValue());
    };
}, false);
