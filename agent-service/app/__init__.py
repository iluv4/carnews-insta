"""carnews agent service package.

NOTE: the warning filter below runs before any submodule (and therefore before
LangGraph) is imported, since importing the `app` package executes this file
first. It silences a *library-internal* pending-deprecation notice that older
LangGraph releases (the `langgraph<1.0` pin in requirements.txt) emit when they
import ``JsonPlusSerializer`` with a default ``allowed_objects``:

    langgraph/cache/base/__init__.py: LangChainPendingDeprecationWarning:
    The default value of `allowed_objects` will change in a future version.

We never call that serializer ourselves (nothing in `app/` touches LangGraph's
cache/serde), so there is no `allowed_objects` argument for us to pass — the
only place to address it is here, by filtering the warning. It is purely
cosmetic and does not affect the graph.
"""
from __future__ import annotations

import warnings

warnings.filterwarnings(
    "ignore",
    message=r".*allowed_objects.*will change.*",
)
