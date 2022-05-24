# Changelog

## [v1.0.0] - 2022-03-30
### Added
 - Initial Release

### Fixed
### Changed

## [v1.0.1] - 2022-05-24
### Added
 - PHP-like HTTP server
 - `$out` template function
 - `$md` template function to render markdown files

### Fixed
 - Path resolution is better

### Changed
 - Script snippets now share a common context across a single template unit. A template unit is anything resolved by a single HTTP request, so any files referenced within templates will have access to the context