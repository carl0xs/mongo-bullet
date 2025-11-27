## Mongo bullet 

### Features

- [ ] Missing index suggestions
- [x] Real-time monitoring
- [ ] Console reporting

## Usage

## Installation

```bash
 pnpm add mongo-bullet
```


### 1. Initialize MongoBullet


Import and initialize `mongo-bullet` at the start of your application.


```typescript
import { initializeMongoBullet } from "mongo-bullet";
import mongoose, { Connection, mongo } from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const uri = process.env.API_DB_URI;
const dbName = process.env.API_DB_NAME;
let conn: Connection | null = null;

export const connectDB = async (): Promise<Connection> => {
  try {
    console.log(`Trying to connect with database...`);
    if (conn) return conn;  

    await mongoose.connect(`${uri}/${dbName}`, {
      monitorCommands: true,
    });

    conn = mongoose.connection;

    initializeMongoBullet(conn)
    console.log(`MongoDB Connected: ${conn.host}`);

    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    // Exit with failure
    process.exit(1);
  }
}

```
