# backend/routes/contact.py
"""
Contact form endpoint.
In production: integrate with SendGrid / SES / SMTP.
For now: logs the submission and returns 200.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class ContactRequest(BaseModel):
    name:    str        = Field(..., min_length=2, max_length=100)
    email:   EmailStr
    subject: str        = Field("", max_length=200)
    message: str        = Field(..., min_length=10, max_length=2000)


@router.post("/contact", status_code=200)
async def submit_contact(body: ContactRequest):
    """
    Receive a contact form submission.
    TODO: replace logger.info with actual email-sending logic (SendGrid / SES).
    """
    logger.info(
        f"📬 Contact form submission from {body.name} <{body.email}> "
        f"| Subject: {body.subject!r}"
    )
    # Example SendGrid integration (commented out — add your API key):
    # import sendgrid
    # sg = sendgrid.SendGridAPIClient(api_key=os.environ.get('SENDGRID_API_KEY'))
    # message = Mail(from_email='noreply@swasthyaseva.com', to_emails='support@swasthyaseva.com',
    #                subject=f"[Contact] {body.subject}", plain_text_content=body.message)
    # sg.send(message)

    return {"success": True, "message": "Thank you! We'll get back to you within 24 hours."}
