# Simple HTML Templating Language

This is a very simple HTML Templating language, complete with its own syntax.

## Templating

The syntax itself is quite simple, allowing you to write HTML in a very legible way.

```jsml
html lang = 'en' {
    head {
        meta charset = 'utf-8';
        meta name = 'viewport' content = 'width=device-width, initial-scale=1';
        title (page_title)

        link rel = 'stylesheet' href = '/static/css/master.css';
        link rel = 'stylesheet' href = '/static/css/layout.css';
        link rel = 'stylesheet' href = '/static/css/styles.css';
    }

    body {
        $include file = '.include/nav.jsml';

        section class = 'main' (renderMd(content))
    }
}
```

A few takeaways here;
* Tag names can contain any non-whitespace character. 
* Attributes are separated by space, and contain both single (`'`) and double (`"`) quotes.
* Self-closing tags such as `meta`, `link` and `img` must be terminated with a semicolon (`;`), otherwise must be followed by a body.
* Body braces (`{ ... }`) can be placed anywhere, not just after a tag. 
* Tags beginning with `$` are references to inbuilt functions. If a function by the name (including `$`) does not exist, the tag is emitted as-is.

### Text
Arbitrary text can be placed inside a text block (`[ ... ]`). Depending on the provided MIME type, will be rendered, or emitted as-is.

The list of supported MIME types is:
* `text/md`: Renders its contents as Markdown
* `text/markdown`: Renders its contents as Markdown
* `text/html+markdown`: Renders its contents as Markdown
* `text/js+node`: Evaluates the given snippet in an isolated NodeJS context server-side. Analogous to PHP. By `yield`ing an expression, it will be evaluated and templated into the output, analogous to PHP's `echo` statements.

### Expression Blocks
Expression blocks (`( ... )`) are evaluated in the same isolated NodeJS context as `text/js+node` text blocks. Variables passed to the templater will be visible here as globals. 
The expression block is replaced by the return value of its expression.

### Attributes
Attributes can template variables, like ES6 template literals. Simply place an expression inside `${...}` and it will be evaluated and inserted.
> **Note:** The implementation for this does not have reliable bracket matching in place, and can fail if complex snippets are included. 
> It's a good idea to use a `text/js+node` block and assign a computed value to a global variable, and referencing it inside the template.
> ```jsml
> [text/js+node glob('title', new Date().toISOString())]
> title title = '$(title)';
> ```
> *The `glob(name: string, value: any)` function sets a binding of name `name` to `value`. It becomes accessible to every subsequent evaluated block, including in attribute templates and expression blocks as global variables.*

## Usage

JSTempl has a simple command line interface, as well as a web server interface which automatically templates files and serves them to clients.

Streaming over the command line interface will yield static files which can be served very quickly through programs such as NGinX or Apache. For simple sites, this is the recommended approach, 
however for more complex interfaces, such as requiring database queries, the webserver can act like PHP with a nodejs backend, allowing you to perform database queries and template them directly into the response. See the documentation below

### Streaming Templating

The program is actually based around stdio. So there aren't any default file input arguments, as they are all used to pass variables to the templater. So you'll need to read files yourself.
Ultimately this is much more freeing, as you can use this outside of the CLI. 

To template a file, you'll need to read the file with `cat`, pipe it through `jsml`, and then redirect the output to the desired output file.

```bash
$ cat template.jsml | ./jstempl page_title 'Page Title' > output.html
```

You'll need to do this for all files you want to template, however can be sped up very quickly with a simple shell script.

```bash
cat package.json | jq -r ".template" | xargs -I{} cat {} | ./jstempl page_title 'Page Title' > output.html
```

This can be placed as a `template` script in your `package.json` file, or embedded into your build system however you see fit. 

### Web Server

The web-server can be invoked with the `nhp` command. It accepts the following paramters:

    * `--port`/`-p`: The port to listen on. Defaults to `8080`.
    * `--tls`: Enable TLS. pass `<key>,<cert>` as the following argument. (Not implemented yet)
    * `--error`: The error page to use. Defaults to `error.html`. The following argument is the error code to use. The argument following it is any .nhp/.jsml file to use as the error page. Can be templated. the `--error` option can be given multiple times, where the last one provided **per error code** is used. 
    * `--root`/`-I`: specify a directory from which to serve files. Defaults to $PWD. Can be passed multiple times, or as the default argument (first argument after `nhp`)
    * `--no-parse-body`: Do not parse the incoming body, it can still be accessed through `body`, except it will be a string containing the body.