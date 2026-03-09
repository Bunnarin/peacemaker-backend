/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1754858045")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_jVTJoZIVBW` ON `source` (\n  `url`,\n  `domain`\n)"
    ]
  }, collection)

  // add field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text2812878347",
    "max": 0,
    "min": 0,
    "name": "domain",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1754858045")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_jVTJoZIVBW` ON `source` (`url`)"
    ]
  }, collection)

  // remove field
  collection.fields.removeById("text2812878347")

  return app.save(collection)
})
