import { PrismaClient } from "@prisma/client";
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PASSWORD_ITERATIONS = 120000;
const PASSWORD_DIGEST = "sha256";
const PASSWORD_KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST).toString("hex");
  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

function loadEnvLocal() {
  try {
    const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");

    for (const line of envFile.split(/\r?\n/)) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match || process.env[match[1]]) continue;

      process.env[match[1]] = (match[2] ?? "").replace(/^["']|["']$/g, "");
    }
  } catch {
    // Keep Prisma's default error if DATABASE_URL is still unavailable.
  }
}

loadEnvLocal();

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

  const waiters = [
    { name: "Joao", email: "joao@lendas.local", from: 1, to: 10 },
    { name: "Maria", email: "maria@lendas.local", from: 11, to: 20 },
    { name: "Pedro", email: "pedro@lendas.local", from: 21, to: 30 }
  ];

  const staff = [
    { name: "Rui", email: "rui@lendas.local", role: "OWNER", password: "rui@2018" },
    { name: "Gerente", email: "manager@lendas.local", role: "MANAGER", password: "manager@2018" },
    { name: "Cozinha", email: "cozinha@lendas.local", role: "KITCHEN", password: "kitchen@2018" },
    ...waiters.map((waiter) => ({
      name: waiter.name,
      email: waiter.email,
      role: "WAITER",
      password: `${waiter.name.toLowerCase()}@2018`
    }))
  ];

  const waitersByRange = [];
  for (const waiter of waiters) {
    const user = await prisma.user.upsert({
      where: {
        restaurantId_email: {
          restaurantId: restaurant.id,
          email: waiter.email
        }
      },
      update: {
        name: waiter.name,
        role: "WAITER"
      },
      create: {
        restaurantId: restaurant.id,
        name: waiter.name,
        email: waiter.email,
        role: "WAITER"
      }
    });
    waitersByRange.push({ ...waiter, id: user.id });
  }

  for (const account of staff) {
    await prisma.user.upsert({
      where: {
        restaurantId_email: {
          restaurantId: restaurant.id,
          email: account.email
        }
      },
      update: {
        name: account.name,
        role: account.role,
        passwordHash: hashPassword(account.password)
      },
      create: {
        restaurantId: restaurant.id,
        name: account.name,
        email: account.email,
        role: account.role,
        passwordHash: hashPassword(account.password)
      }
    });
  }

  const categoryNames = [
    "Hamburgueres",
    "Porcoes",
    "Petiscos",
    "Espetinhos",
    "Caipirinhas",
    "Batidas de Frutas",
    "Coqueteis",
    "Drinks Especiais",
    "Drinks Premium",
    "Cervejas 600ml",
    "Destilados",
    "Combos"
  ];
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

  const removedCategoryNames = ["Coxinhas", "Bomba"];

  await prisma.product.updateMany({
    where: {
      restaurantId: restaurant.id,
      category: { name: { in: removedCategoryNames } }
    },
    data: { active: false }
  });

  await prisma.category.updateMany({
    where: {
      restaurantId: restaurant.id,
      name: { in: removedCategoryNames }
    },
    data: { active: false }
  });

  const products = [
    ["Hamburguer Lendas", "Blend da casa, cheddar e molho red", 2990, "Hamburgueres"],
    ["Batata Suprema", "Batata crocante, bacon e creme cheddar", 1690, "Porcoes"],
    ["Carne de Sol c/ Fritas Simples", "400g, macaxeira, farofa, vinagrete e molho", 7500, "Petiscos"],
    ["Carne de Sol c/ Fritas Completa", "400g, macaxeira, baiao de dois, vinagrete, farofa e molho", 9000, "Petiscos"],
    ["Calabresa Especial Simples", "400g, farofa, vinagrete e molho", 4000, "Petiscos"],
    ["Calabresa Especial Completa", "400g, baiao de dois, farofa, vinagrete e molho", 5500, "Petiscos"],
    ["Frango a Passarinho Simples", "400g, dados de macaxeira, farofa e vinagrete", 5000, "Petiscos"],
    ["Frango a Passarinho Completo", "400g, dados de macaxeira, feijao tropeiro, baiao de dois, farofa e vinagrete", 6500, "Petiscos"],
    ["Espetinho de Carne", "Acompanha vinagrete, farofa, feijao tropeiro e arroz", 2000, "Espetinhos"],
    ["Espetinho de Frango", "Acompanha vinagrete, farofa, feijao tropeiro e arroz", 1500, "Espetinhos"],
    ["Espetinho Misto", "Acompanha vinagrete, farofa, feijao tropeiro e arroz", 2000, "Espetinhos"],
    ["Espetinho Suino", "Acompanha vinagrete, farofa, feijao tropeiro e arroz", 1500, "Espetinhos"],
    ["Espetinho de Lingua", "Acompanha vinagrete, farofa, feijao tropeiro e arroz", 1500, "Espetinhos"],
    ["Batata Frita Simples", "400g, molho especial", 2500, "Porcoes"],
    ["Batata Frita Completa", "400g, queijo, bacon, oregano e molho especial", 3000, "Porcoes"],
    ["Calabresa c/ Batata Simples", "400g, batata frita e molho especial", 4000, "Porcoes"],
    ["Calabresa c/ Batata Completa", "400g, batata frita, farofa, vinagrete e molho especial", 5500, "Porcoes"],
    ["File com Fritas Simples", "400g, dados de macaxeira, farofa e molho", 7000, "Porcoes"],
    ["File com Fritas Completo", "400g, dados de macaxeira, baiao de dois, vinagrete e maria isabel", 8500, "Porcoes"],
    ["Caldinho de Macaxeira c/ Costela Simples", "400ml, milho, farofa, ovo de codorna", 1500, "Porcoes"],
    ["Caldinho de Macaxeira c/ Costela Completo", "400ml, bacon, milho, azeitona, ovo de codorna e farofa", 2000, "Porcoes"],
    ["Caldo Dobradinha a Paulista Simples", "400ml, milho, farofa e ovo de codorna", 2000, "Porcoes"],
    ["Caldo Dobradinha a Paulista Completo", "400ml, queijo, bacon, milho, azeitona, ovo de codorna e farofa", 2500, "Porcoes"],
    ["Manjubinhas Simples", "400g, farofa, vinagrete e molho especial", 3000, "Porcoes"],
    ["Manjubinhas Completa", "400g, bacon, milho, azeitona, ovo de codorna e farofa", 4500, "Porcoes"],
    ["Pastelzinhos", "8 unidades, sabores variados: carne, queijo, frango e costela. Acompanha molho especial", 3000, "Porcoes"],
    ["Torresmo c/ Macaxeira Simples", "400g, feijao tropeiro e molho especial", 4500, "Porcoes"],
    ["Torresmo c/ Macaxeira Completo", "400g, feijao tropeiro, farofa, vinagrete e molho", 5500, "Porcoes"],
    ["Tripinha Frita Simples", "300g, feijao tropeiro, farofa, vinagrete e molho", 3000, "Porcoes"],
    ["Tripinha Frita Completa", "300g, feijao tropeiro, dados de macaxeira, farofa, vinagrete e molho", 4500, "Porcoes"],
    ["Coco Blue", "Vodka, gin, leite de coco, limao e energetico", 2500, "Coqueteis"],
    ["Margarita", "Tequila, licor de laranja e suco de limao", 2500, "Coqueteis"],
    ["Afrodite", "Vodka, curacao, xarope simples, suco de limao e energetico de acai", 2500, "Coqueteis"],
    ["Caipirinha de Limao", "Vodka 51, gelo e acucar", 1200, "Caipirinhas"],
    ["Caipirinha de Abacaxi", "Vodka 51, gelo e acucar", 1200, "Caipirinhas"],
    ["Caipirinha de Maracuja", "Vodka 51, gelo e acucar", 1600, "Caipirinhas"],
    ["Caipirinha de Morango", "Vodka 51, gelo e acucar", 1600, "Caipirinhas"],
    ["Caipirinha de Kiwi", "Vodka 51, gelo e acucar", 1600, "Caipirinhas"],
    ["Caipirinha Mista", "Vodka 51, gelo e acucar", 2000, "Caipirinhas"],
    ["Batida de Limao", "Vodka, leite condensado, gelo e acucar", 1800, "Batidas de Frutas"],
    ["Batida de Morango", "Vodka, leite condensado, iogurte, gelo e acucar", 2000, "Batidas de Frutas"],
    ["Batida de Maracuja", "Vodka, leite condensado, iogurte, gelo e acucar", 2000, "Batidas de Frutas"],
    ["Batida de Abacaxi", "Vodka, leite condensado, gelo e acucar", 1800, "Batidas de Frutas"],
    ["Batida de Kiwi", "Vodka, leite condensado, gelo e acucar", 2000, "Batidas de Frutas"],
    ["Espanhola", "Vinho, abacaxi e leite condensado", 2000, "Batidas de Frutas"],
    ["Beats Fruta", "Fruta, Skol Beats e vodka", 2500, "Coqueteis"],
    ["Dama de Vermelho", "Keep Cooler, vodka e morango", 2500, "Coqueteis"],
    ["Flor de Maracuja", "Gin, energetico citrico, xarope simples, maracuja e suco de limao", 2500, "Coqueteis"],
    ["Pina Colada", "Rum, leite de coco, leite condensado e abacaxi", 2500, "Coqueteis"],
    ["Tropical Malibu", "Rum, suco de limao e abacaxi", 2500, "Coqueteis"],
    ["Frozen", "Fruta, vodka e licor", 3000, "Coqueteis"],
    ["Drink 369", "Vodka, licor de pessego e energetico de pessego", 2500, "Coqueteis"],
    ["Mai Tai", "Rum escuro, limao, licor de laranja e xarope de amendoas", 2500, "Coqueteis"],
    ["Lagoa Vermelha", "Vodka, licor de morango, mix de limao e soda limonada", 2000, "Drinks Especiais"],
    ["Mojito", "Vodka, rum, hortela e agua com gas", 2000, "Drinks Especiais"],
    ["Sex on the Beach", "Vodka, licor de pessego e suco de laranja", 2000, "Drinks Especiais"],
    ["Stock Night", "Vodka, licor de cassis, mix de limao e soda limonada", 2000, "Drinks Especiais"],
    ["Submarino", "Cerveja, cachaca e suco de limao", 2000, "Drinks Especiais"],
    ["Caipicerva", "Cerveja, vodka e suco de limao", 2000, "Drinks Especiais"],
    ["Daiquiri", "Fruta, rum, suco de limao e xarope simples", 2000, "Drinks Especiais"],
    ["Dry Martini", "Gin, vermute e azeitona", 2000, "Drinks Especiais"],
    ["Gin Fizz", "Fruta, gin, hortela e agua com gas", 2000, "Drinks Especiais"],
    ["Lagoa Azul", "Vodka, curacao blue, mix de limao e soda limonada", 2000, "Drinks Especiais"],
    ["Lagoa Verde", "Vodka, licor de menta, mix de limao e soda limonada", 2000, "Drinks Especiais"],
    ["Cosmopolitan", "Vodka, licor de laranja e grenadine", 2000, "Drinks Especiais"],
    ["Black Russian", "Whisky, licor de cafe e soda limonada", 2000, "Drinks Especiais"],
    ["Michelada Tropical", "Cerveja, fruta, sal, suco de limao, maracuja e manga", 2500, "Drinks Especiais"],
    ["Mousse Bacardi", "Rum, vodka, amarula e limao", 2500, "Drinks Especiais"],
    ["Aperol Spritz", "Vermute, aperol, suco de laranja e sprite", 2500, "Drinks Especiais"],
    ["Caipile", "Vodka, fruta e picole", 2500, "Drinks Especiais"],
    ["Negroni", "Bitter, gin e vermute", 2500, "Drinks Especiais"],
    ["Damaris", "Whisky, bitter, suco de limao e hortela", 2500, "Drinks Especiais"],
    ["Alexandre", "Conhaque, licor de cacau e leite condensado", 2500, "Drinks Especiais"],
    ["Eva Paraiso", "Vodka, rum de maca, limao e energetico", 2500, "Drinks Especiais"],
    ["Moscow Mule", "Vodka, suco de limao e espuma de gengibre", 2500, "Drinks Especiais"],
    ["Teresina Quente", "Vodka, St Remy, maracuja e limao", 2500, "Drinks Especiais"],
    ["Nega Maluca", "Rum escuro, doce de leite e limao", 2500, "Drinks Especiais"],
    ["Bahama Mama", "Rum, rum de coco, laranja e abacaxi", 2200, "Drinks Premium"],
    ["Meu Sertao", "Cachaca, aperol, abacaxi, limao e hortela", 2200, "Drinks Premium"],
    ["Margarita de Coco", "Tequila, aperol, licor de laranja e leite de coco", 2700, "Drinks Premium"],
    ["Solteirinha", "Rum, vodka, gin, licor, suco de laranja e soda limonada", 3000, "Drinks Premium"],
    ["Brahma 600ml", "Cerveja 600ml", 1200, "Cervejas 600ml"],
    ["Skol 600ml", "Cerveja 600ml", 1200, "Cervejas 600ml"],
    ["Stella Artois 600ml", "Cerveja 600ml", 1500, "Cervejas 600ml"],
    ["Foguinho", "Dose de destilado", 500, "Destilados"],
    ["Sao Francisco", "Dose de destilado", 500, "Destilados"],
    ["Lira", "Dose de destilado", 600, "Destilados"],
    ["Bananinha", "Dose de destilado", 600, "Destilados"],
    ["Campari", "Dose de destilado", 1200, "Destilados"],
    ["Montilla", "Dose de destilado", 700, "Destilados"],
    ["Dose de Whisky", "Dose de whisky", 1500, "Destilados"]
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

  for (let number = 1; number <= 30; number += 1) {
    const assignedWaiter = waitersByRange.find((waiter) => number >= waiter.from && number <= waiter.to);

    await prisma.table.upsert({
      where: { qrToken: String(number) },
      update: {
        restaurantId: restaurant.id,
        number,
        assignedWaiterId: assignedWaiter?.id
      },
      create: {
        restaurantId: restaurant.id,
        number,
        qrToken: String(number),
        assignedWaiterId: assignedWaiter?.id
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
