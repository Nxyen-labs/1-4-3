from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from io import BytesIO

from app.database import get_db
from app.auth.dependencies import RoleChecker
from app.auth.models import User
from app.spills.models import Spill
from app.impact.models import ImpactAssessment
from app.attribution.models import SuspectScore
from app.vessels.models import Vessel

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{spill_id}/pdf")
async def generate_pdf_report(
    spill_id: int,
    user: User = Depends(RoleChecker(["coast_guard", "regional_manager", "higher_authority"])),
    db: AsyncSession = Depends(get_db),
):
    """Generate PDF evidence report for a spill. Role-scoped content."""
    # Fetch spill
    spill_result = await db.execute(select(Spill).where(Spill.id == spill_id))
    spill = spill_result.scalar_one_or_none()
    if not spill:
        raise HTTPException(status_code=404, detail="Spill not found")

    # Fetch impact
    impact_result = await db.execute(
        select(ImpactAssessment).where(ImpactAssessment.spill_id == spill_id)
    )
    impact = impact_result.scalar_one_or_none()

    # Fetch suspects (only for authenticated roles)
    suspects_result = await db.execute(
        select(SuspectScore, Vessel)
        .join(Vessel, SuspectScore.vessel_id == Vessel.id)
        .where(SuspectScore.spill_id == spill_id)
        .order_by(SuspectScore.rank)
        .limit(5)
    )
    suspects = suspects_result.all()

    from app.reports.generator import build_evidence_pdf
    pdf_bytes = build_evidence_pdf(
        spill=spill,
        impact=impact,
        suspects=suspects,
        user_role=user.role,
    )

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="SARVAS-Forensic-Report-{spill.name}.pdf"'
        },
    )
