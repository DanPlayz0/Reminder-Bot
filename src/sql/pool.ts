import configuration from "@/configuration";
import { Pool } from "pg";

const pool = new Pool({ connectionString: configuration.postgres_url });
export default pool;