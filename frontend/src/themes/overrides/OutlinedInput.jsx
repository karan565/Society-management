// ==============================|| OVERRIDES - OUTLINED INPUT ||============================== //

export default function OutlinedInput(theme, borderRadius, outlinedFilled) {
  return {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          background: outlinedFilled ? theme.vars.palette.grey[50] : 'transparent',
          borderRadius: `${borderRadius}px`,

          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.vars.palette.grey[400]
          },

          '&:hover $notchedOutline': {
            borderColor: theme.vars.palette.primary.light
          },

          '&.MuiInputBase-multiline': {
            padding: 1
          }
        },
        input: {
          fontWeight: 500,
          background: outlinedFilled ? theme.vars.palette.grey[50] : 'transparent',
          padding: '15.5px 14px',
          borderRadius: `${borderRadius}px`,
          '&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus, &:-webkit-autofill:active': {
            WebkitBoxShadow: '0 0 0 100px #fff inset !important',
            boxShadow: '0 0 0 100px #fff inset !important',
            WebkitTextFillColor: `${theme.vars.palette.text.primary} !important`,
            caretColor: theme.vars.palette.text.primary,
            backgroundColor: '#fff !important',
            transition: 'background-color 5000s ease-in-out 0s'
          },

          '&.MuiInputBase-inputSizeSmall': {
            padding: '10px 14px',

            '&.MuiInputBase-inputAdornedStart': {
              paddingLeft: 0
            }
          }
        },
        inputAdornedStart: {
          paddingLeft: 4
        },
        notchedOutline: {
          borderRadius: `${borderRadius}px`
        }
      }
    }
  };
}
