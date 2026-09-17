# Repository ownership

## Authoritative source

This Moodlelike repository is the authoritative source for all product development after the 2026-09-17 standalone cutover. Features, fixes, migrations, tests and documentation are authored and reviewed here.

The former CSCALite workspace is historical provenance only. It is not a build input, package dependency, code-generation source or required sibling checkout. No automatic back-sync or forward-sync is permitted between the repositories.

## Active and historical surfaces

Runtime code, deployment files, package scripts, CI workflows and current operating documentation must use repository-relative paths and Moodlelike product identity. Historical architecture and decision records may retain original names and paths when changing them would falsify the record; they are not executable instructions.

The extraction program is retained only in the historical source workspace and is intentionally absent here. The `test:repository-ownership` gate rejects its return and rejects absolute references to the former workspace from active repository surfaces.

## Compatibility debt

Internal `CSCA_*`, `CSCALITE_*` and related domain names may remain where they are versioned runtime, data or integration contracts. Rename them only through an explicit alias, migration, deprecation and rollback plan. Their presence does not make the former repository an upstream dependency.

## Data boundary

Repository ownership does not authorize access to, copying of or migration from any real CSCALite database, upload store, credential set or user dataset. Those operations require a separately approved data-cutover procedure.
