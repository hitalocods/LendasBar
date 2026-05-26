import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "lendas-2018" },
    update: {
      name: "LENDAS 2018",
      accent: "#d71920",
      background: "#050505",
      logoUrl: "/lendas-logo.png"
    },
    create: {
      name: "LENDAS 2018",
      slug: "lendas-2018",
      accent: "#d71920",
      background: "#050505",
      logoUrl: "/lendas-logo.png"
    }
  });

  const categoryNames = ["Coxinhas", "Hamburgueres", "Bebidas", "Combos", "Porcoes"];
  const categories = {};

  for (const [index, name] of categoryNames.entries()) {
    categories[name] = await prisma.category.upsert({
      where: {
        restaurantId_name: {
          restaurantId: restaurant.id,
          name
        }
      },
      update: { sortOrder: index, active: true },
      create: {
        restaurantId: restaurant.id,
        name,
        sortOrder: index
      }
    });
  }

  const products = [
    ["Coxinha Tradicional", "Frango desfiado com catupiry", 790, "Coxinhas"],
    ["Coxinha com Catupiry", "Massa crocante e recheio cremoso da casa", 890, "Coxinhas"],
    ["Hamburguer Lendas", "Blend da casa, cheddar e molho red", 2990, "Hamburgueres"],
    ["Batata Suprema", "Batata crocante, bacon e creme cheddar", 1690, "Porcoes"]
  ];

  for (const [name, description, priceCents, categoryName] of products) {
    const existing = await prisma.product.findFirst({
      where: {
        restaurantId: restaurant.id,
        name
      }
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          description,
          priceCents,
          categoryId: categories[categoryName].id,
          active: true
        }
      });
    } else {
      await prisma.product.create({
        data: {
          restaurantId: restaurant.id,
          categoryId: categories[categoryName].id,
          name,
          description,
          priceCents
        }
      });
    }
  }

  for (let number = 1; number <= 20; number += 1) {
    await prisma.table.upsert({
      where: { qrToken: String(number) },
      update: {
        restaurantId: restaurant.id,
        number
      },
      create: {
        restaurantId: restaurant.id,
        number,
        qrToken: String(number)
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
