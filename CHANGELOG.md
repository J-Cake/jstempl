# Changelog

## [v1.1.3] - 25.05.22
### Added
 - `$md` [template function to render markdown files hassle-free](https://github.com/J-Cake/jstempl/wiki/Templating-Functions#md-file-string).
 - `$use` [template function to use templates in reverse. Specify a parent template file, stead of a child template file](https://github.com/J-Cake/jstempl/wiki/Templating-Functions#usetemplate-string-as-string). 
 - `$def` [template function to define a template](https://github.com/J-Cake/jstempl/wiki/Custom-Templating-Functions)
 - You can now specify templates for markdown files with the [`--markdown` flag](https://github.com/J-Cake/jstempl/wiki/CLI).

### Fixed
 - `$include` template function now correctly passes it's arguments to the included template.
 - `$include` now only renders its content as JSML if the `content_type` argument is set to `text/jsml`. If set to a markdown MIME type, will render as Markdown, otherwise plain text.

## [v1.0.1] - 2022-05-24
### Added
 - PHP-like HTTP server
 - `$out` template function
 - `$md` template function to render markdown files

### Fixed
 - Path resolution is better

### Changed
 - Script snippets now share a common context across a single template unit. A template unit is anything resolved by a single HTTP request, so any files referenced within templates will have access to the context

## [v0.0.3] - 2022-03-30
### Added
### Changed
 - `$include`s now can render the text they fetch, or continue to emit JSML
### Fixed
 - functional tags now evaluate their arguments

## [v0.0.1] - 2022-03-30
### Added
 - Initial Release

### Fixed
### Changed