import { google } from "googleapis";
import { credentials } from "../credentials/credentials.js";

const sheets = google.sheets("v4");

const addRowToSheet = async ({ auth, spreadsheetId, values }) => {
  const request = {
    spreadsheetId,
    range: "reservas",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    resource: {
      values: [values],
    },
    auth,
  };

  try {
    const response = await sheets.spreadsheets.values.append(request).data;
    return response;
  } catch (error) {
    console.error(error);
  }
};

const appendToSheet = async ({ data }) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const authClient = await auth.getClient();
    const spreadsheetId = "1til-bkUIBvMYJE8QlCOftlh4INH8-JlLOHFr47dycUM";

    await addRowToSheet({
      auth: authClient,
      spreadsheetId,
      values: data,
    });
    return "Successfully";
  } catch (error) {
    console.log(error);
  }
};

export { appendToSheet };
