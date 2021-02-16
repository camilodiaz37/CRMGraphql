const Usuario = require("../model/Usuario");
const Producto = require("../model/Producto");
const Cliente = require("../model/Cliente");
const Pedido = require("../model/Pedidos");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "variables.env" });

const crearToken = (usuario, secreta, expiresIn) => {
  const { id, email, nombre, apellido } = usuario;

  return jwt.sign({ id, email, nombre, apellido }, secreta, { expiresIn });
};
//resolver
const resolvers = {
  Query: {
    obtenerUsuario: async (_, {}, ctx) => {
      /* const usuarioId = await jwt.verify(token, process.env.SECRETA);
      return usuarioId; */
      return ctx.usuario;
    },
    obtenerProductos: async () => {
      try {
        const productos = await Producto.find({});
        return productos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerProducto: async (_, { id }) => {
      //revisar si existe id
      const producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("Producto no encontrado");
      }
      return producto;
    },
    obtenerClientesVendedor: async (_, {}, ctx) => {
      try {
        const cliente = await Cliente.find({
          vendedor: ctx.usuario.id.toString(),
        });
        return cliente;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerCliente: async (_, { id }, ctx) => {
      const cliente = await Cliente.findById(id);
      if (!cliente) {
        throw new Error("Cliente no encontrado");
      }
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      return cliente;
    },
    obtenerPedidos: async () => {
      try {
        const pedidos = await Pedido.find({});
        return pedidos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerPedidosVendedor: async (_, {}, ctx) => {
      try {
        const pedidos = await Pedido.find({ vendedor: ctx.usuario.id }).populate('cliente');
        console.log(pedidos)
        return pedidos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerPedido: async (_, { id }, ctx) => {
      //pedido existe?
      const pedido = await Pedido.findById(id);
      if (!pedido) {
        throw new Error("El pedido no existe");
      }
      //el pedido es del usuario?
      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }
      //retornar el resultado
      return pedido;
    },
    obtenerPedidosEstado: async (_, { estado }, ctx) => {
      const pedidos = await Pedido.find({
        vendedor: ctx.usuario.id,
        estado,
      });
      return pedidos;
    },
    mejoresClientes: async () => {
      const clientes = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$cliente",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "clientes",
            localField: "_id",
            foreignField: "_id",
            as: "cliente",
          },
        },
      ]);
      return clientes;
    },
    mejoresVendedores: async () => {
      const vendedores = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$vendedor",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "usuarios",
            localField: "_id",
            foreignField: "_id",
            as: "vendedor",
          },
        },
        {
          $limit: 3,
        },
        {
          $sort: { total: 1 },
        },
      ]);
      return vendedores;
    },
    buscarProducto: async (_, { texto }) => {
      const productos = await Producto.find({ $text: { $search: texto } });

      return productos;
    },
  },
  Mutation: {
    nuevoUsuario: async (_, { input }) => {
      const { email, password } = input;

      //revisar si usuario esta registrado
      const existeUsuario = await Usuario.findOne({ email });
      if (existeUsuario) {
        throw new Error("El usuario ya esta registrado");
      }
      //Hashear password
      const salt = await bcryptjs.genSalt(10);
      input.password = await bcryptjs.hash(password, salt);

      try {
        //guardar en base de datos
        const usuario = new Usuario(input);
        usuario.save(); //guardar
        return usuario;
      } catch (error) {
        console.log(error);
      }
    },
    autenticarUsuario: async (_, { input }) => {
      const { email, password } = input;

      //Comprobar si el usuario existe
      const existeUsuario = await Usuario.findOne({ email });
      if (!existeUsuario) {
        throw new Error("El usuario no existe");
      }
      //revisar si el password es correcto
      const passwordCorrecto = await bcryptjs.compare(
        password,
        existeUsuario.password
      );
      if (!passwordCorrecto) {
        throw new Error("El password es incorrecto");
      }
      //crear token
      return {
        token: crearToken(existeUsuario, process.env.SECRETA, "24h"),
      };
    },
    nuevoProducto: async (_, { input }) => {
      try {
        const producto = new Producto(input);

        //almacenar en base de datos
        const resultado = await producto.save();
        return resultado;
      } catch (error) {
        console.log(error);
      }
    },
    actualizarProducto: async (_, { id, input }) => {
      //revisar si usuario esta registrado
      let producto = await Producto.findOne({ id });
      if (producto) {
        throw new Error("El producto no existe");
      }
      //guardarlo en bd
      producto = await Producto.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return producto;
    },
    eliminarProducto: async (_, { id }) => {
      //revisar si usuario esta registrado
      let producto = await Producto.findOne({ id });
      if (producto) {
        throw new Error("El producto no existe");
      }
      //eliminar producto
      producto = await Producto.findOneAndDelete({ _id: id });
      return "EL prducto ha sido eliminado";
    },
    nuevoCliente: async (_, { input }, ctx) => {
      //revisar si cliente esta registrado
      const { email } = input;
      const cliente = await Cliente.findOne({ email });
      if (cliente) {
        throw new Error("Este cliente ya esta registrado");
      }
      const nuevoCliente = new Cliente(input);
      //asignar vendedor
      nuevoCliente.vendedor = ctx.usuario.id;
      //guardar en bd
      try {
        const resultado = nuevoCliente.save();
        return resultado;
      } catch (error) {
        console.log(error);
      }
    },
    actualizarCliente: async (_, { id, input }, ctx) => {
      //Verificar si existe o no
      let cliente = await Cliente.findById(id);
      if (!cliente) {
        throw new Error("Ese cliente no existe");
      }
      //verificar si el vendedor es el que edita
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes credenciales");
      }
      cliente = await Cliente.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return cliente;
    },
    eliminarCliente: async (_, { id }, ctx) => {
      //Verificar si existe o no
      let cliente = await Cliente.findById(id);
      if (!cliente) {
        throw new Error("Ese cliente no existe");
      }
      //verificar si el vendedor es el que edita
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes credenciales");
      }
      cliente = await Cliente.findOneAndDelete({_id:id})
      return "Cliente eliminado"
    },
    nuevoPedido: async (_, { id, input }, ctx) => {
      const { cliente } = input;

      //verificar si cliente existe
      let clienteExiste = await Cliente.findById(cliente);
      if (!clienteExiste) {
        throw new Error("EL cliente no existe");
      }
      //verificar si cliente es del vendedor
      if (clienteExiste.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes credenciales del cliente");
      }
      //revisar si hay stock
      for await (const articulo of input.pedido) {
        const { id } = articulo;
        const producto = await Producto.findById(id);
        if (articulo.cantidad > producto.existencia) {
          throw new Error(
            `El articulo: ${producto.nombre} excede la cantidad disponible ${articulo.cantidad} vs ${producto.existencia}`
          );
        } else {
          //restar cantidad a inventario
          producto.existencia = producto.existencia - articulo.cantidad;
          await producto.save();
        }
      }
      //crear nuevo pedido
      const nuevoPedido = new Pedido(input);
      //asignar vendedor
      nuevoPedido.vendedor = ctx.usuario.id;
      //guardar en base de datos
      const resultado = await nuevoPedido.save();
      return resultado;
    },
    actualizarPedido: async (_, { id, input }, ctx) => {
      //verificar si pedido existe
      const existePedido = await Pedido.findById(id);
      if (!existePedido) {
        throw new Error("El pedido no existe");
      }
      //verificar si cliete existe
      const { cliente } = input;
      const existeCliente = await Cliente.findById(cliente);
      if (!existeCliente) {
        throw new Error("El cliente no existe");
      }

      //cliente pertenece a usuario
      if (existeCliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      //revisar stock
      if (input.pedido) {
        for await (const articulo of input.pedido) {
          const { id } = articulo;
          const producto = await Producto.findById(id);
          if (articulo.cantidad > producto.existencia) {
            throw new Error(
              `El articulo: ${producto.nombre} excede la cantidad disponible ${articulo.cantidad} vs ${producto.existencia}`
            );
          } else {
            //restar cantidad a inventario
            producto.existencia = producto.existencia - articulo.cantidad;
            await producto.save();
          }
        }
      }
      //guardar pedido
      const resultado = await Pedido.findByIdAndUpdate({ _id: id }, input, {
        new: true,
      });
      return resultado;
    },
    eliminarPedido: async (_, { id }, ctx) => {
      //revisar si pedido existe
      const pedido = await Pedido.findById(id);
      if (!pedido) {
        throw new Error("El pedido no existe");
      }
      //revisar si el pedido es del vendedor
      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes credenciales");
      }
      //Buscar y borrar el pedido
      await Pedido.findByIdAndDelete({ _id: id });
      return "El pedido ha sido eliminado";
    },
  },
};

module.exports = resolvers;
