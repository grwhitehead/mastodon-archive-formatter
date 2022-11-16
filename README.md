# Mastodon archive formatter

Node JS command line tool to format a mastodon archive into a single html file
* sorts by date
* assembles threads

DISCLAIMER: This was a quick hack to meet a specific need, pulling together threads. I probably won't put much more time into it.

## Running

(see requirements below)

Format entire archive
```
% node format.js -d PATH_TO_MASTODON_ARCHIVE
```

Format one or more threads
```
% node format.js -d PATH_TO_MASTODON_ARCHIVE ID ...
```

## Requirements

* Node (https://nodejs.org)

On MacOS:
```
% brew install node
% npm install optparse
```

Copyright (c) 2022 Greg Whitehead

MIT License
