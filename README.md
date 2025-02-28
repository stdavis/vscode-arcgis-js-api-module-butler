# ArcGIS JS API Module Butler

![butler](./butler.png)

Quickly add ES import statements for any exported object in the `@arcgis/core` package without leaving your current code context.

## The Problem

You are in the middle of writing some sweet code and you need to import a new module from the ArcGIS Maps SDK for JavaScript. You know the module name, but you don't want to have to go look up the exact path to the module. You also don't want to have to scroll to the top of your module and type out the import statement.

## The Solution

This extension adds a command to the command palette that will add an import statement for any exported object in the `@arcgis/core` package. Just run the `ArcGIS Butler: Add Module Import` command and select the module you want to import. The extension will automatically add the appropriate import statement to the top of the file allowing you to carrying on writing your sweet code without having to context switch.

## Commands

- ArcGIS Butler: Add Module Import
- ArcGIS Butler: Clear Cached

## Development

### Debugging

Open this project in VSCode and press `F5` to start debugging.

### Publishing a new version

1. Manually bump version number in package.json
1. Update changelog below
1. Create release commit and associated tag
1. `npx vsce publish`

## Release Notes

### 1.1.0

Add support for nested node_modules directories

### 1.0.2

Fix crash caused by ArcGIS modules with syntax errors.

### 1.0.1

Add better introduction to README

Add icon

### 1.0.0

Initial release
