const { ApolloServer } = require("apollo-server");
const typeDefs = require("./db/schema");
const resolvers = require("./db/resolvers");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "variables.env" });

const conectarDB = require("./config/db");

//conectar base de datos
conectarDB();

//servidor
const server = new ApolloServer({
  typeDefs,
  resolvers,
  cors:{
    origin:"*",
    credentials:true
  },
  context: ({ req }) => {
    const token = req.headers["authorization"] || "";
    if (token) {
      try {
        const usuario = jwt.verify(token.replace("Bearer ", ""), process.env.SECRETA);
        return {
          usuario,
        };
      } catch (error) {
        console.log(error);
      }
    }
  },
});

//arrancar servidor
server.listen({port: process.env.PORT || 4000}).then(({ url }) => {
  console.log(`servidor listo en la URL ${url}`);
});
