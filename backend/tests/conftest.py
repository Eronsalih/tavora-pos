"""Shared test setup.

The real app needs MongoDB settings at import time, so we give it
harmless values. Tests never talk to a real database: they use the
small in-memory FakeDatabase below.
"""

import os

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017")
os.environ.setdefault("MONGODB_DB_NAME", "tavora_test")
os.environ.setdefault("APP_ENV", "development")


class FakeInsertManyResult:
    def __init__(self, inserted_ids):
        self.inserted_ids = inserted_ids


class FakeCollection:
    """Supports only the few MongoDB operations our services use."""

    def __init__(self):
        self.docs = []

    @staticmethod
    def _matches(doc, query):
        return all(doc.get(key) == value for key, value in query.items())

    async def find_one(self, query, projection=None):
        return next((d for d in self.docs if self._matches(d, query)), None)

    async def count_documents(self, query):
        return sum(1 for d in self.docs if self._matches(d, query))

    async def insert_one(self, document):
        from bson import ObjectId

        document.setdefault("_id", ObjectId())
        self.docs.append(document)

    async def insert_many(self, documents):
        for document in documents:
            await self.insert_one(document)
        return FakeInsertManyResult([d["_id"] for d in documents])

    async def update_one(self, query, update):
        document = await self.find_one(query)
        if document is not None:
            document.update(update.get("$set", {}))


class FakeDatabase(dict):
    def __missing__(self, name):
        self[name] = FakeCollection()
        return self[name]

    # Services use both database["tables"] and database.tables
    def __getattr__(self, name):
        return self[name]
