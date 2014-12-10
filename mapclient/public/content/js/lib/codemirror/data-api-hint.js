// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

(function (mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
        mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
        define(["../../lib/codemirror"], mod);
    else // Plain browser env
        mod(CodeMirror);
})(function (CodeMirror) {
    var Pos = CodeMirror.Pos;

    function forEach(arr, f) {
        for (var i = 0, e = arr.length; i < e; ++i) f(arr[i]);
    }

    function arrayContains(arr, item) {
        if (!Array.prototype.indexOf) {
            var i = arr.length;
            while (i--) {
                if (arr[i] === item) {
                    return true;
                }
            }
            return false;
        }
        return arr.indexOf(item) != -1;
    }

   
    var funcProps = "prototype apply call bind".split(" ");
    
    function getCompletions(token, context, options) {
        var keywords = [];

        if ((token) && (token.type === 'property')) {
            if (typeof PublicaMundi.Data.Query === 'function') {
                for (var prop in PublicaMundi.Data.Query.prototype) {
                    if ((PublicaMundi.Data.Query.prototype.hasOwnProperty(prop)) &&
                       (typeof PublicaMundi.Data.Query.prototype[prop] === 'function')) {
                        keywords.push(prop);
                    }
                }
            }
        }

        var found = [], start = token.string, global = options && options.globalScope || window;
        function maybeAdd(str) {
            if (str.lastIndexOf(start, 0) == 0 && !arrayContains(found, str)) found.push(str);
        }
        function gatherCompletions(obj) {
            if (obj instanceof Function) forEach(funcProps, maybeAdd);

            for (var name in obj) maybeAdd(name);
        }

        forEach(keywords, maybeAdd);

        return found;
    }

    function scriptHint(editor, getToken, options) {
        // Find the token at the cursor
        var cur = editor.getCursor(), token = getToken(editor, cur);

        if (/\b(?:string|comment)\b/.test(token.type)) return;
        token.state = CodeMirror.innerMode(editor.getMode(), token.state).state;

        // If it's not a 'word-style' token, ignore the token.
        if (!/^[\w$_]*$/.test(token.string)) {
            token = {
                start: cur.ch, end: cur.ch, string: "", state: token.state,
                type: token.string == "." ? "property" : null
            };
        } else if (token.end > cur.ch) {
            token.end = cur.ch;
            token.string = token.string.slice(0, cur.ch - token.start);
        }

        var tprop = token;
        // If it is a property, find out what it is a property of.
        while (tprop.type == "property") {
            tprop = getToken(editor, Pos(cur.line, tprop.start));
            if (tprop.string != ".") return;
            tprop = getToken(editor, Pos(cur.line, tprop.start));
            if (!context) var context = [];
            context.push(tprop);
        }
 
        return {
            list: getCompletions(token, context, options),
            from: Pos(cur.line, token.start),
            to: Pos(cur.line, token.end)
        };
    }
    
    function javascriptHint(editor, options) {
        return scriptHint(editor,
                          function (e, cur) { return e.getTokenAt(cur); },
                          options);
    };

    CodeMirror.registerHelper("hint", "javascript", javascriptHint);
});
