/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 0,
        "min": 0,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "number314755213",
        "max": null,
        "min": null,
        "name": "post_count",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      }
    ],
    "id": "pbc_1978854890",
    "indexes": [],
    "listRule": "",
    "name": "stance_rank",
    "system": false,
    "type": "view",
    "updateRule": null,
    "viewQuery": "SELECT \n    stance as id, \n    COUNT(*) AS post_count\nFROM \n    post\nGROUP BY \n    stance;",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1978854890");

  return app.delete(collection);
})
