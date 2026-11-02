# Grade Calculator

**By:** Vilina Prenko

A desktop grade calculator built with Electron and SQL Server. Create classes, split each one into weighted grade categories, enter your grades, and calculate your final grade.

## How the Final Grade Is Calculated

1. Each category's score is the average of its grades.
2. Each average is multiplied by the category's weight.
3. The results are added up.

Rules:
- Category weights must add up to exactly 100%, or no grade is calculated and a warning is shown.
- A category with no grades counts as 0%.
- Scores are percentages from 0 to 200, so extra credit is possible.

## Requirements

- [Node.js](https://nodejs.org/en/download) (npm is included)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Tested on Windows

## Set Up

1. Download or clone the project.
2. Check that Node and npm work:
   ```
   node -v
   npm -v
   ```
3. In the project folder, install the dependencies:
   ```
   npm install
   ```

## Database Setup

The app uses SQL Server running in a Docker container.

1. Make sure Docker Desktop is running.
2. Start the container. SQL Server requires a strong password: at least 8 characters, using three of: uppercase, lowercase, digits, symbols.
   ```
   docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=Your_Str0ng_Passw0rd" -p 127.0.0.1:1433:1433 -v sqlserver_data:/var/opt/mssql --name sqlserver -d mcr.microsoft.com/mssql/server:2022-latest
   ```
   - `127.0.0.1:` makes the database reachable only from your own machine.
   - `-v sqlserver_data:...` keeps your data if the container is removed and recreated.
3. Confirm it is running with `docker ps`. You should see `127.0.0.1:1433->1433/tcp`.
4. Create the database and tables by running `database/schema.sql` once, using any SQL Server client (Azure Data Studio, SSMS, or similar). Connect to `localhost`, port `1433`, user `sa`, with your password, and trust the server certificate.

In later sessions, start the existing container with `docker start sqlserver` instead of step 2.

## Connection Settings

1. Copy `database_example.js` to `database.js`. This file is listed in `.gitignore`, so your password is never committed.
2. Access the database replace the `'YourPassword'` fallback in `database.js`.
3. The other settings are already correct for the container above: server `localhost`, port `1433`, user `sa`, database `Grade_Calculator`, `trustServerCertificate: true` (acceptable for a local container).

## How to Run

```
npm start
```

## How to Use

1. Type a name under **Class** and click **Add Class**.
2. Add grade categories with their weights. The total shown under the list should reach 100%.
3. Add grades, choosing a category for each.
4. Click **Calculate My Grade**.

Click any category or grade row to edit it. The button changes to **Update**. Click the row again, or **Cancel**, to go back to adding.

## Database Structure

Created in ChartDB. Deleting a class cascades to its categories, and deleting a category cascades to its grades.

![Database structure image](assets/image.png)
