import logging
import os
from pymongo import MongoClient, ReturnDocument
from backend.app.config import settings

logger = logging.getLogger("MongoSession")

# Initialize Client
mongo_url = settings.DATABASE_URL
if not mongo_url.startswith("mongodb"):
    # If the user still has SQLite configuration in .env but wants MongoDB, let's look for MONGODB_URI or fallback to localhost
    mongo_url = os.environ.get("MONGODB_URI") or "mongodb://localhost:27017/leadforge"
    logger.warning(f"DATABASE_URL is not a MongoDB URI. Falling back to MongoDB URI: {mongo_url}")

# Create connection client
client = MongoClient(mongo_url)
db = client.get_database() # Gets database from URI path, or fallback to default 'leadforge'

# Initialize MongoDB Indexes
try:
    db.users.create_index("email", unique=True)
    db.search_histories.create_index("user_id")
    db.leads.create_index("search_history_id")
    db.leads.create_index("name")
    logger.info("MongoDB indexes initialized successfully!")
except Exception as e:
    logger.error(f"Error creating MongoDB indexes: {e}")

# Sequence generator for auto-increment IDs
def get_next_sequence_value(db_instance, name: str) -> int:
    ret = db_instance.counters.find_one_and_update(
        {"_id": name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER
    )
    return ret["seq"]

# Session wrapper that behaves like SQLAlchemy session Maker (returns database client instance)
class MongoSessionLocal:
    def __call__(self):
        return db
    def close(self):
        pass

SessionLocal = MongoSessionLocal()

def get_db():
    yield db
