package com.example.ekyc.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class EkycRequestDto {

    @NotBlank(message = "Aadhaar or VID is required")
    @Pattern(regexp = "^[0-9]{12}$", message = "Aadhaar/VID must be exactly 12 numeric digits")
    private String aadhaarOrVid;

    @NotBlank(message = "ID type is required")
    @Pattern(regexp = "^(AADHAAR|VID)$", message = "ID type must be either AADHAAR or VID")
    private String idType;

    @NotNull(message = "Identity verification consent is mandatory")
    private Boolean identityVerificationConsent;

    @Pattern(regexp = "^(YES|NO)$", message = "Mobile/email consent must be either YES or NO")
    private String mobileEmailConsent;

    @NotBlank(message = "Session ID is required")
    private String sessionId;

    private String parentProcessId;

    public EkycRequestDto() {}

    public EkycRequestDto(String aadhaarOrVid, String idType, Boolean identityVerificationConsent, 
                         String mobileEmailConsent, String sessionId, String parentProcessId) {
        this.aadhaarOrVid = aadhaarOrVid;
        this.idType = idType;
        this.identityVerificationConsent = identityVerificationConsent;
        this.mobileEmailConsent = mobileEmailConsent;
        this.sessionId = sessionId;
        this.parentProcessId = parentProcessId;
    }

    public String getAadhaarOrVid() {
        return aadhaarOrVid;
    }

    public void setAadhaarOrVid(String aadhaarOrVid) {
        this.aadhaarOrVid = aadhaarOrVid;
    }

    public String getIdType() {
        return idType;
    }

    public void setIdType(String idType) {
        this.idType = idType;
    }

    public Boolean getIdentityVerificationConsent() {
        return identityVerificationConsent;
    }

    public void setIdentityVerificationConsent(Boolean identityVerificationConsent) {
        this.identityVerificationConsent = identityVerificationConsent;
    }

    public String getMobileEmailConsent() {
        return mobileEmailConsent;
    }

    public void setMobileEmailConsent(String mobileEmailConsent) {
        this.mobileEmailConsent = mobileEmailConsent;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getParentProcessId() {
        return parentProcessId;
    }

    public void setParentProcessId(String parentProcessId) {
        this.parentProcessId = parentProcessId;
    }
}