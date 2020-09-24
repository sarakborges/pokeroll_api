const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const MongoClient = require("mongodb").MongoClient;

MongoClient.connect(
  "mongodb+srv://jrkb:pGsDiARhXzRRM65@cluster0-jxm1r.mongodb.net/pokemon",
  (err, client) => {
    if (err) {
      console.log(err);
      return;
    }

    const app = express();
    const db = client.db("pokemon");
    const collection = db.collection("rolagens");

    app.use(cors());
    app.use(bodyParser.json());
    app.use(express.urlencoded({ extended: false }));

    app.get("/rolls/getAll", (req, res) => {
      const { query } = req;

      const pageSize = 30;
      const curPage = query.page;
      const pageSkip = pageSize * (curPage - 1);

      let totalResults = 0;

      collection.countDocuments((err, count) => {
        totalResults = count;

        collection
          .find()
          .sort({ time: -1 })
          .skip(pageSkip)
          .limit(pageSize)
          .toArray((err, results) => {
            res.send({
              results,
              totalResults,
              totalPages: Math.ceil(totalResults / pageSize),
            });
          });
      });
    });

    app.get("/rolls/getPlaces", (req, res) => {
      const ret = [];
      const pokemons = [];

      try {
        const pokemonsDir = fs.readdirSync(
          path.join(process.cwd(), "json", "pokemon")
        );

        for (let file of pokemonsDir) {
          const pokemonData = require(`./json/pokemon/${file}`);
          pokemons[file.replace(".json", "")] = pokemonData;
        }
      } catch (err) {
        console.log({ err, function: "pokemons" });
      }

      try {
        const biomesDir = fs.readdirSync(
          path.join(process.cwd(), "json", "biomes")
        );

        for (let file of biomesDir) {
          const biomeData = require(`./json/biomes/${file}`);
          const rares = [];
          const ultrarares = [];

          for (let key of Object.keys(biomeData.pokemonsList.rare)) {
            rares.push(biomeData.pokemonsList.rare[key]);
          }
          for (let key of Object.keys(biomeData.pokemonsList.ultrarare)) {
            ultrarares.push(biomeData.pokemonsList.ultrarare[key]);
          }

          ret.push({
            name: biomeData.name,
            common: biomeData.pokemonsList.common.list.map((pokemon) => {
              return pokemons[pokemon];
            }),
            uncommon: biomeData.pokemonsList.uncommon.list.map((pokemon) => {
              return pokemons[pokemon];
            }),
            rare: rares.map((pokemon) => {
              return pokemons[pokemon];
            }),
            ultrarare: ultrarares.map((pokemon) => {
              return pokemons[pokemon];
            }),
          });
        }
      } catch (err) {
        console.log({ err, function: "biomes" });
      }

      res.send(ret);
    });

    app.post("/rolls/create", (req, res) => {
      const { body } = req;

      const { biome, character, quantityRolls, badges } = body;

      const biomeData = require(`./json/biomes/${biome}.json`);

      const data = {
        character: character,
        time: new Date(),
        biome: biomeData.name,
        pokemons: [],
      };

      for (let i = 0; i < quantityRolls; i++) {
        const randomPokemon = `${Math.ceil(Math.random() * 100)}`;
        let pokemon;

        if (
          randomPokemon >= biomeData.pokemonsList.common.from &&
          randomPokemon <= biomeData.pokemonsList.common.to
        ) {
          pokemon = "common";
        } else if (
          randomPokemon >= biomeData.pokemonsList.uncommon.from &&
          randomPokemon <= biomeData.pokemonsList.uncommon.to
        ) {
          pokemon = "uncommon";
        } else {
          for (let pokemonItem of Object.keys(biomeData.pokemonsList.rare)) {
            for (let keyItem of pokemonItem.split(",")) {
              if (keyItem === randomPokemon) {
                pokemon = biomeData.pokemonsList.rare[pokemonItem];
                break;
              }

              if (pokemon !== undefined) {
                break;
              }
            }
          }

          if (pokemon === undefined) {
            for (let pokemonItem of Object.keys(
              biomeData.pokemonsList.ultrarare
            )) {
              if (pokemonItem === randomPokemon) {
                pokemon = biomeData.pokemonsList.ultrarare[pokemonItem];
                break;
              }
            }
          }
        }

        let pokemonData = {};

        const genderRandom = Math.ceil(Math.random() * 2);
        const abilityRandom = Math.ceil(Math.random() * 2);

        if (pokemon !== "common" && pokemon !== "uncommon") {
          pokemonData = require(`./json/pokemon/${pokemon}.json`);

          const genderless = pokemonData.genderRate.genderless !== undefined;
          const femaleOnly = pokemonData.genderRate.male === 0;
          const maleOnly = pokemonData.genderRate.female === 0;

          if (genderless) {
            pokemonData.gender = "genderless";
          } else if (maleOnly) {
            pokemonData.gender = "male";
          } else if (femaleOnly) {
            pokemonData.gender = "female";
          } else if (genderRandom === 1) {
            pokemonData.gender = "male";
          } else if (genderRandom === 2) {
            pokemonData.gender = "female";
          }

          if (pokemonData.abilities.length === 3) {
            pokemonData.ability = pokemonData.abilities[abilityRandom - 1];
          } else {
            pokemonData.ability = pokemonData.abilities[0];
          }
        } else {
          if (genderRandom === 1) {
            pokemonData.gender = "male";
          } else if (genderRandom === 2) {
            pokemonData.gender = "female";
          }

          pokemonData.ability = abilityRandom;
        }

        pokemonData.level = Math.ceil(Math.random() * (15 + badges * 10));

        data.pokemons.push({
          id: pokemon,
          name: pokemonData.name ? pokemonData.name : pokemon,
          gender: pokemonData.gender,
          types: pokemonData.types ? pokemonData.types : [],
          ability: pokemonData.ability,
          level: pokemonData.level,
        });
      }

      collection.insertOne(data);

      res.send(data);
    });

    app.listen(4000);
  }
);
