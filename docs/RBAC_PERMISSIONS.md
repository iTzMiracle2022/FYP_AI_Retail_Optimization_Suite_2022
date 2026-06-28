# Role-Based Access Control (RBAC) Permission Matrix

This document provides a clean, single source-of-truth description of the Role-Based Access Control (RBAC) system implemented in the AI Retail Optimization Suite.

---

## 1. Role Hierarchy

The system operates in a B2B SaaS context where a retailer company deploys this suite. Under this configuration, the `System Admin` represents the retailer company's own top-level decision-maker, owner, or IT lead (not the external software developer).

The access control hierarchy is structured as follows:

```
System Admin  (highest — full control, manages users and approvals directly)
   ↓
Manager       (team & business-operations level — manages approvals, uploads, runs ML)
   ↓
Analyst       (runs segmentations/churn runs, uploads data, read-only dashboard visibility)
   ↓
Viewer        (read-only dashboard visibility, cannot upload datasets or trigger analyses)
```

---

## 2. Final Permission Matrix

| Action | System Admin | Manager | Analyst | Viewer |
|---|---|---|---|---|
| **Upload new dataset** | Yes | Yes | Yes | No |
| **Run/trigger predictions, analysis** | Yes | Yes | Yes | No |
| **View dashboards/results** | Yes | Yes | Yes | Yes |
| **Delete a dataset** | Yes (direct) | Yes (direct) | Requires approval | No |
| **Create/edit/delete team accounts** | Yes (direct) | Yes (direct) | No | No |
| **View/approve pending approval requests** | Yes | Yes | No | No |
| **Access audit logs** | Yes (full, unscoped) | Yes (scoped to non-Admin activity only) | No | No |
| **Connect external SQL/ERP sync** | Not yet active (disabled) | Not yet active (disabled) | No | No |

---

## 3. Enforcement Notes

Below are the backend file paths and route-level controllers where these rules are enforced:

* **Upload new dataset**
  - **Enforcement**: [dataset_routes.py](file:///home/abdul/fyp_codex_safe/backend/api/dataset_routes.py#L34-L38)
  - **Logic**: Enforces that the `X-User-Role` header must be in `['System Admin', 'Manager', 'Analyst']`. Viewers receive a `403 Forbidden`.

* **Run/trigger predictions, analysis**
  - **Enforcement**: 
    - Churn Prediction: [churn_routes.py](file:///home/abdul/fyp_codex_safe/backend/api/churn_routes.py#L1128-L1130)
    - Inventory Forecast: [inventory_routes.py](file:///home/abdul/fyp_codex_safe/backend/api/inventory_routes.py#L14-L18)
    - Marketing Segmentation: [marketing_routes.py](file:///home/abdul/fyp_codex_safe/backend/api/marketing_routes.py#L466-L468)
    - Sales Trend Analysis: [sales_routes.py](file:///home/abdul/fyp_codex_safe/backend/api/sales_routes.py#L27-L44)
  - **Logic**: If the requester is a `Viewer`, fresh retrain or prediction requests (uncached runs) are blocked and rejected with `403 Forbidden`. Read-only actions (viewing pre-existing model snapshots or report charts in the database) remain fully accessible to Viewers.

* **View dashboards/results**
  - **Enforcement**: Open to all authenticated sessions. Checked globally via token validation in [app.py](file:///home/abdul/fyp_codex_safe/backend/app.py#L86-L105).

* **Delete a dataset**
  - **Enforcement**: [dataset_routes.py](file:///home/abdul/fyp_codex_safe/backend/api/dataset_routes.py#L198-L202)
  - **Logic**: Managers and System Admins delete datasets directly. Analysts trigger a pending deletion approval request (`DELETE_DATASET`) in MongoDB instead of direct execution. Viewers are blocked.

* **Create/edit/delete team accounts**
  - **Enforcement**: [user_routes.py](file:///home/abdul/fyp_codex_safe/backend/api/user_routes.py) (e.g. `add_user`, `delete_user`, `update_user_role`)
  - **Logic**: System Admins and Managers apply changes immediately. Analysts trigger approval requests (`ADD_USER`, `DELETE_USER`, `UPDATE_ROLE`). Viewers are blocked.

* **View/approve pending approval requests**
  - **Enforcement**: [user_routes.py](file:///home/abdul/fyp_codex_safe/backend/api/user_routes.py#L310-L368) (e.g. `/api/users/approvals`, `/api/users/approve`, `/api/users/reject`)
  - **Logic**: Rejects requests with `403 Forbidden` if `X-User-Role` is not in `['Manager', 'System Admin']`.

* **Access audit logs**
  - **Enforcement**: [system_routes.py](file:///home/abdul/fyp_codex_safe/backend/api/system_routes.py#L89-L109) (`/api/system/audit-logs`)
  - **Logic**: Enforces role validation gating. Analysts and Viewers receive a `403 Forbidden`. If the role is `Manager`, the database query is scoped to exclude `System Admin` logs: `{'user_role': {'$ne': 'System Admin'}}`.

* **Connect external SQL/ERP sync**
  - **Enforcement**: [connector_routes.py](file:///home/abdul/fyp_codex_safe/backend/api/connector_routes.py#L13-L17) (`/api/connectors/*` before_request hook)
  - **Logic**: Filters out roles other than `['System Admin', 'Manager']` with a `403`. 
  - *Note*: The routes and blueprint are intentionally commented out and disabled in [app.py](file:///home/abdul/fyp_codex_safe/backend/app.py#L56) for this release.

---

## 4. Known Design Decisions

* **System Admin Direct Authority**: The System Admin is the top authority in this enterprise scope and is never required to submit approval requests to a Manager. Pre-existing code checking `role != 'Manager'` has been updated to check `role not in ['Manager', 'System Admin']`.
* **Manager's Audit Scoping Limitation**: Managers are scoped to non-Admin audit records. Because the `users` collection does not have a formal team hierarchy concept (such as a `manager_email` or `team_id` field), scoping is based on excluding `System Admin` actions rather than querying a team relational structure.
* **Connector Blueprint Disabled**: The SQL/ERP connector is configured with proper security hooks, but its routes are intentionally disabled at the blueprint level in `app.py` pending future external release.
