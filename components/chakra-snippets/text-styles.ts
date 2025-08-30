// text-styles.ts
import { defineTextStyles } from "@chakra-ui/react"

export const textStyles = defineTextStyles({
  tinyText: {
    value: {
      fontSize: {
        base: "12px",
        sm:   "12px",
        md:   "12px",
        lg:   "14px",
        xl:   "14px",
        "2xl":"14px",
      },
    },
  },
  
  smallText: {
    value: {
      fontSize: {
        base: "14px",
        sm:   "14px",
        md:   "14px",
        lg:   "16px",
        xl:   "16px",
        "2xl":"16px",
      },
    },
  },
  
  basicText: {
    value: {
      fontSize: {
        base: "18px",
        sm:   "18px",
        md:   "18px",
        lg:   "18px",
        xl:   "18px",
        "2xl":"18px",
      },
    },
  },
  //  textStyle={"basicText"}

  subheading: {
    value: {
      fontSize: {
       
          base: "18px",
          sm:   "18px",
          md:   "18px",
          lg:   "26px",
          xl:   "26px",
          "2xl":"26px",
      },
   
    },
  },
  // textStyle={"subheading"}
  heading: {
    value: {
      fontSize: {
        base: "50px",
        sm:   "50px",
        md:   "50px",
        lg:   "50px",
        xl:   "50px",
        "2xl":"50px",
      },
   
    },
  },
  // textStyle={"heading"}
  title: {
    value: {
      fontSize: {
        base: "32px",
        sm:   "40px",
        md:   "50px",
        lg:   "60px",
        xl:   "80px",
        "2xl":"90px",
      },
     
    },
  },
  // textStyle={"title"}
  display: {
    value: {
      fontSize: {
        base: "48px",
        sm:   "60px",
        md:   "70px",
        lg:   "80px",
        xl:   "100px",
        "2xl":"110px",
      },
     
    },
  },
})

// textStyle={"display"}