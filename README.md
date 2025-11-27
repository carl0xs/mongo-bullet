## Mongo Bullet

Mongo Bullet is a lightweight and powerful monitoring tool for Mongoose. It helps you identify performance bottlenecks by analyzing your MongoDB queries in real time.

### Features

*   **Real time monitoring**: Captures and analyzes MongoDB commands as they happen.
*   **Missing index suggestions**: Identifies queries that could benefit from indexes and suggests them to you.
*   **Console reporting**: Displays reports and suggestions directly in your console.

### How it works

Mongo Bullet attaches a listener to your Mongoose connection and monitors the commands sent to your MongoDB database. It analyzes these commands to find inefficiencies and provides actionable suggestions to improve your database's performance.

### Installation

To install Mongo Bullet, use your favorite package manager.

```bash
pnpm add mongo-bullet
```

### Usage

To start using Mongo Bullet, you need to initialize it after establishing your Mongoose connection.

#### 1. Initialize MongoBullet

Import and initialize `mongo-bullet` at the start of your application.

```typescript
import { initializeMongoBullet } from "mongo-bullet";
import mongoose, { Connection } from 'mongoose';

export const connectDB = async (): Promise<Connection> => {
  try {
    await mongoose.connect(process.env.API_DB_URI, {
      dbName: process.env.API_DB_NAME,
      monitorCommands: true, // Enables command monitoring
    });

    const conn = mongoose.connection;
    initializeMongoBullet({
        connection: conn, 
        slowThreshold: 150 // Optional. Default value is 100.
    });

    console.log(`MongoDB Connected: ${conn.host}`);
    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
```

### Configuration

At the moment, Mongo Bullet does not require any specific configuration.

### Contributing

Contributions are welcome. If you have any ideas, suggestions, or bug reports, please open an issue or submit a pull request.

### License

This project is licensed under the ISC License.
