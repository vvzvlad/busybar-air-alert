# Air Raid Alert

Air raid alerts for up to three regions of Ukraine and Israel.

A JavaScript app for [BUSY Bar](https://busy.app). Work in progress.

## What it does

- Pick up to three regions in the settings.
- Quiet while there is no alert. During an alert the screen turns red with a flashing siren and the region's name, with a sound and the status light. The all-clear shows green for a minute.
- Checks every 15 to 30 seconds.

## Data

[ubilling.net.ua aerial alerts](https://ubilling.net.ua/aerialalerts/) for Ukraine and [Tzeva Adom](https://www.tzevaadom.co.il) for Israel, no keys needed.

## Build

Node 24 and npm:

```sh
npm ci
npm run build         # dist/io.github.vvzvlad.airalert.tgz
npm run app:install   # install it on a BUSY Bar connected over USB
npm run app:run       # start it
```

## License

[MIT](LICENSE)
