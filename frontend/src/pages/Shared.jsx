import React from "react";
import { Box, Typography } from "@mui/material";

// A4 Page Container
export const PageContainer = ({ children }) => {
  return (
    <Box
      className="page"
      sx={{
        width: "210mm",
        minHeight: "300mm",
        margin: "auto",
        padding: "25mm 20mm",
        background: "#fff",
        fontFamily: "Times New Roman",
        fontSize: "12pt",
        lineHeight: 1.6,
      }}
    >
      {children}
    </Box>
  );
};

// Letterhead
export default function Letterhead() {
  return (
    <Box sx={{ textAlign: "center", mb: 3 }}>
      <Typography sx={{ fontWeight: "bold" }}>
        Abhikalpana Rachna Kendra
      </Typography>
      <Typography>
        Architecture · Planning · Landscape · Interiors
      </Typography>
      <Typography>
        Email: infoatLivincart@gmail.com | Ph: 1234567890
      </Typography>
      <Typography>
        Visakhapatnam – 530040
      </Typography>
    </Box>
  );
}

// Bank Details
export const BankDetails = () => {
  return (
    <Box sx={{ mt: 4 }}>
      <Typography sx={{ fontWeight: "bold" }}>Bank Details:</Typography>
      <Typography>Abhikalpana Rachna Kendra</Typography>
      <Typography>A/c No: 126905500081</Typography>
      <Typography>IFSC: ICIC0001269</Typography>
      <Typography>HSL Complex Branch</Typography>
    </Box>
  );
};