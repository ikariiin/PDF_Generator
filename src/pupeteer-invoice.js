// import puppeteer, { PDFMargin } from "puppeteer";
// import { template } from "lodash";
// import { promises as fs } from "fs";
// import { resolve, join } from "path";
// import { getData } from "./data-provider";
const puppeteer = require("puppeteer");
const { template, ..._ } = require("lodash");
const { promises: fs, readFileSync } = require("fs");
const { resolve, join } = require("path");
const { v4: uuid } = require("uuid");
const imgDataUri = require("image-data-uri");

function generateTable({ headers, rows }, taxBreakUps) {
  function generateClass(header) {
    return `t-${header.toLowerCase()}`;
  }

  const thead = `
  <thead>
    <tr>
      ${headers
        .map((header) => `<th class="${generateClass(header)}">${header}</th>`)
        .join("\n")}
    </tr>
  </thead>
  `;

  const taxBreakupRows = Object.keys(taxBreakUps)
    .map((taxBracket) => {
      const length = headers.length;
      const highlightClass = taxBracket.toLowerCase().includes("total")
        ? "t-highlight"
        : "";
      if (length < 2)
        throw new Error("Cannot produce table with less than two columns");
      return `
    <tr>
      ${Array.from(
        new Array(length - 2),
        () => `<td class="${highlightClass}"></td>`
      ).join("\n")}
      <td class="t-price ${highlightClass}">
        ${taxBracket}
      </td>
      <td class="t-total ${highlightClass}">
        ${taxBreakUps[taxBracket]}
      </td>
    </tr>
    `;
    })
    .join("\n");

  const parsedRows = rows.map((row) => row.map((item) => parseFloat(item)));
  const accumulator = {};
  parsedRows.forEach((row) => {
    row.forEach((item, index) => {
      if (isNaN(item)) return;
      const prevSum = accumulator[index];
      if (!prevSum) accumulator[index] = item;
      else accumulator[index] += item;
    });
  });
  const totalRow = Array.from(new Array(headers.length), (curr, index) => {
    if (index === 0) {
      return `<td class="t-highlight"></td>`;
    }
    const accValue = accumulator[index];
    if (isNaN(accValue)) return `<td class="t-highlight t-price"></td>`;
    return `<td class="t-highlight a-right t-total">${accValue}</td>`;
  }).join("\n");

  const tbody = `
  <tbody>
    ${rows
      .map(
        (columns) =>
          `<tr>
          ${columns
            .filter((col) => col !== "class")
            .map(
              (value, idx) =>
                `<td class="${generateClass(headers[idx])}">${value}</td>`
            )
            .join("\n")}
          </tr>`
      )
      .join("\n")}
      ${totalRow}
      ${taxBreakupRows}
  </tbody>
  `;

  return `
  <table class="data-table">
    ${thead}
    ${tbody}
  </table>
  `;
}

async function generateInvoice({
  poDetails = {
    buyersName: "",
    poNumber: "",
    createdAt: new Date(),
    deliveryDate: new Date(),
    createdBy: "",
    contact: "",
  },
  vendorDetails = {
    name: "",
    billingAddress: "",
    pincode: "",
    gstin: "",
    pan: "",
  },
  itemDetails = [
    {
      ID: "",
      Description: "",
      Unit: "",
      Quantity: 0,
      Make: "",
      Price: "",
      Tax: "",
      Total: "",
      Tax_percent: "",
      Tax_num: "",
    },
  ],
  extra = {
    termsAndConditions: "",
  },
  image = {
    url: "https://i.imgur.com/JVo5CYH.png",
    // file: "",
  },
  billDetails = {
    name: "",
    address: "",
    pincode: "",
    gst: "",
  },
  shippingDetails = {
    name: "",
    address: "",
    pincode: "",
  },
  table = {
    headers: [
      "ID",
      "Name",
      "Category",
      "Description",
      "Unit",
      "Make",
      "Quantity",
      "Price",
      "Total",
    ],
    // Rows should be an array of arrays
    rows: [],
  },
  taxBreakups = {
    "SGST@4.5%": "100",
    "CST@4.5%": "100",
    "Taxable Amount": "200",
    "Total Amount": "90000",
  },
}) {
  // Header and footer template for the PDF document
  const header = `
  <header style="
    font-family: Roboto, Inter, sans-serif;
    display: flex;
    width: 557px;
    border: 1px solid transparent;
    border-bottom: none;
    margin-left: 18px;
  ">
      ${
        image
          ? `<div style="margin: 32px 22px; flex-grow: 1; display: flex; align-items: center;">
          <img
            style="
              max-width: 175px;
              height: 25px;
            "
            src="
              ${
                image.file
                  ? await imgDataUri.encodeFromFile(readFileSync(image.file))
                  : await imgDataUri.encodeFromURL(image.url)
              }
            "
          />
        </div>`
          : `<div
          style="
            font-size: 18px;
            margin: 32px 22px;
            flex-grow: 1;
            font-weight: 700;
          "
        >
          ${poDetails.buyersName}
        </div>`
      }
      
      <div
        style="
          font-size: 7px;
          margin: 32px 38px;
          line-height: 2;
        "
      >
        <section style="">
          <div style="display: flex">
            <div style="width: 90px">Purchase Order#</div>
            <div style="width: 150px">: ${poDetails.poNumber}</div>
          </div>
          <div style="display: flex">
            <div style="width: 90px">Order Date</div>
            <div style="width: 150px">: ${new Date(
              poDetails.createdAt
            ).toDateString()}</div>
          </div>
          <div style="display: flex">
            <div style="width: 90px">Delivery Date</div>
            <div style="width: 150px">: ${new Date(
              poDetails.deliveryDate
            ).toDateString()}</div>
          </div>
          <div style="display: flex">
            <div style="width: 90px">Purchaser</div>
            <div style="width: 150px">: ${poDetails.createdBy}</div>
          </div>
          <div style="display: flex">
            <div style="width: 90px">Contact Details</div>
            <div style="width: 150px">: ${poDetails.contact}</div>
          </div>
        </section>
      </div>
    </header>
    `;
  const footer = `
    <footer style="
      font-size: 6px;
      color: #E7E6E6;
      width: 557px;
      border: 1px solid transparent;
      border-top: none;
      margin-left: 18px;
    ">
      <div style="text-align: left; padding-left: 16px;">
        Page <span class="pageNumber"></span> /
        <span class="totalPages"></span>
      </div>
      <div style="text-align: center; margin-bottom: 5px;">
        Powered by mysiteapp.co
      </div>
    </footer>
  `;

  // Initialises the templating variables to be used in the HTML document
  const templateConfig = {
    // Bill:
    bill_name: billDetails.name,
    bill_address: billDetails.address,
    bill_pincode: billDetails.pincode,
    bill_gst: billDetails.gst,
    // Vendor
    vendor_name: vendorDetails.name,
    vendor_address: vendorDetails.billingAddress,
    vendor_pincode: vendorDetails.pincode,
    vendor_gst: vendorDetails.gstin,
    vendor_pan: vendorDetails.pan,
    // Shipping
    shipping_name: shippingDetails.name,
    shipping_address: shippingDetails.address,
    shipping_pincode: shippingDetails.pincode,
    // Table items
    data_table: generateTable(table, taxBreakups),
    // Terms and condition
    terms: extra.termsAndConditions.split("\n").map((term) => term.trim()),
  };

  const file = template(
    (
      await fs.readFile(
        resolve(join(__dirname, "..", "template", "invoice.template.html"))
      )
    ).toString()
  );
  // Initialises puppeteer
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(
    file({
      ...templateConfig,
      table_items: itemDetails,
    })
  );
  await page.evaluateHandle("document.fonts.ready");

  const createdPath = resolve(join("docs", `${uuid()}.pdf`));
  // Generates pdf
  await page.pdf({
    path: createdPath,
    format: "a4",
    margin: {
      top: "200px",
      bottom: "45px",
      right: "25px",
      left: "25px",
    },
    headerTemplate: header,
    footerTemplate: footer,
    displayHeaderFooter: true,
  });

  // Cleanup
  await browser.close();

  // Ends
  return createdPath;
}

module.exports = generateInvoice;
